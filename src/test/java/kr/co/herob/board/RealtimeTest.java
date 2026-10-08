package kr.co.herob.board;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/** 실제 서버를 띄워 SSE 변경분 푸시와 WebSocket 위치 채널을 검증합니다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:realtimedb;DB_CLOSE_DELAY=-1",
    "app.admin.password=admin"})
class RealtimeTest {

    @LocalServerPort int port;
    @Autowired ObjectMapper json;

    private record Client(String cookie, String characterId, String username) {}

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void 위치는_WebSocket으로_전달되고_소유하지_않은_캐릭터는_무시된다() throws Exception {
        Client a = signUp("posa"), b = signUp("posb");
        BlockingQueue<JsonNode> received = new LinkedBlockingQueue<>();
        WebSocket wsB = openSocket(b, received);
        JsonNode snapshot = next(received);
        assertEquals("snapshot", snapshot.get("type").asText());
        WebSocket wsA = openSocket(a, new LinkedBlockingQueue<>());

        // 남의 캐릭터 위치는 무시, 범위를 벗어난 값도 무시
        wsA.sendText(move(b.characterId(), 10, 10), true).join();
        Thread.sleep(150);
        wsA.sendText(move(a.characterId(), 99999, 10), true).join();
        Thread.sleep(150);
        wsA.sendText(move(a.characterId(), 300, 200), true).join();

        JsonNode pos = next(received);
        assertEquals("pos", pos.get("type").asText());
        assertEquals(a.characterId(), pos.get("id").asText());
        assertEquals(300, pos.get("x").asInt());
        assertEquals(200, pos.get("y").asInt());

        // 나중에 접속한 사용자는 마지막 위치를 snapshot으로 받는다
        BlockingQueue<JsonNode> late = new LinkedBlockingQueue<>();
        openSocket(signUp("posc"), late);
        JsonNode lateSnapshot = next(late);
        boolean found = false;
        for (JsonNode p : lateSnapshot.get("list")) if (p.get("id").asText().equals(a.characterId())) found = p.get("x").asInt() == 300;
        assertTrue(found, "snapshot에 마지막 위치가 있어야 합니다");
        wsA.abort();
        wsB.abort();
    }

    @Test
    void 인사_동작은_다른_접속자에게만_전달되고_저장되지_않는다() throws Exception {
        Client a = signUp("bowa"), b = signUp("bowb");
        BlockingQueue<JsonNode> received = new LinkedBlockingQueue<>();
        WebSocket wsB = openSocket(b, received);
        assertEquals("snapshot", next(received).get("type").asText());
        WebSocket wsA = openSocket(a, new LinkedBlockingQueue<>());
        wsA.sendText("{\"id\":\"" + a.characterId() + "\",\"x\":120,\"y\":130,\"w\":\"office\",\"e\":\"bow\"}", true).join();
        JsonNode pos = next(received);
        assertEquals("pos", pos.get("type").asText());
        assertEquals("bow", pos.get("e").asText());
        Thread.sleep(150);
        wsA.sendText("{\"id\":\"" + a.characterId() + "\",\"x\":121,\"y\":130,\"w\":\"office\",\"e\":\"dance\"}", true).join();
        assertFalse(next(received).has("e"), "허용되지 않은 동작은 전달하지 않는다");
        BlockingQueue<JsonNode> late = new LinkedBlockingQueue<>();
        openSocket(signUp("bowc"), late);
        for (JsonNode p : next(late).get("list")) assertFalse(p.has("e"), "스냅샷에는 동작이 없다");
        wsA.abort();
        wsB.abort();
    }

    @Test
    void 로그인하지_않으면_위치_채널에_접속할_수_없다() {
        BlockingQueue<JsonNode> received = new LinkedBlockingQueue<>();
        var future = http.newWebSocketBuilder().buildAsync(URI.create("ws://localhost:" + port + "/ws/pos"), listener(received));
        assertThrows(Exception.class, () -> future.get(5, TimeUnit.SECONDS));
    }

    @Test
    void 문서변경은_변경분_이벤트로_전달되고_비공개_메시지는_참여자에게만_내용이_간다() throws Exception {
        Client a = signUp("sea"), b = signUp("seb"), outsider = signUp("sec");
        BlockingQueue<String> bEvents = sse(b), outsiderEvents = sse(outsider);
        assertTrue(waitFor(bEvents, "event:connected"), "connected 이벤트");
        assertTrue(waitFor(outsiderEvents, "event:connected"));

        send("PUT", "/api/doc/nicks/" + a.characterId(), a, "{\"n\":\"Delta\"}");
        String data = waitForData(bEvents, "event:doc");
        JsonNode doc = json.readTree(data);
        assertEquals("set", doc.get("op").asText());
        assertEquals("nicks", doc.get("col").asText());
        assertEquals(a.characterId(), doc.get("id").asText());
        assertEquals("Delta", doc.get("body").get("n").asText());
        assertTrue(doc.get("seq").asLong() > 0);

        send("POST", "/api/chats/private", a, json.writeValueAsString(Map.of("recipients", java.util.List.of(b.username()), "text", "비밀")));
        String privateData = waitForData(bEvents, "event:private");
        assertEquals("비밀", json.readTree(privateData).get("message").get("text").asText());
        // 비참여자는 내용 없이 seq만 받는다
        String seqData = waitForData(outsiderEvents, "event:seq");
        assertFalse(seqData.contains("비밀"));
        assertFalse(outsiderEvents.stream().anyMatch(l -> l.contains("비밀")));
    }

    private Client signUp(String prefix) throws Exception {
        String username = prefix + UUID.randomUUID().toString().substring(0, 8);
        HttpResponse<String> reg = rawSend("POST", "/api/register", null,
            json.writeValueAsString(Map.of("username", username, "password", "pass1234")));
        assertEquals(202, reg.statusCode());
        HttpResponse<String> adminLogin = rawSend("POST", "/api/login", null, "{\"username\":\"admin\",\"password\":\"admin\"}");
        Client admin = new Client(adminLogin.headers().firstValue("Set-Cookie").orElseThrow().split(";")[0], null, "admin");
        assertEquals(204, rawSend("POST", "/api/admin/accounts/" + username + "/approve", admin, "{}").statusCode());
        HttpResponse<String> login = rawSend("POST", "/api/login", null,
            json.writeValueAsString(Map.of("username", username, "password", "pass1234")));
        assertEquals(200, login.statusCode());
        String cookie = login.headers().firstValue("Set-Cookie").orElseThrow().split(";")[0];
        Client temp = new Client(cookie, null, username);
        HttpResponse<String> created = rawSend("POST", "/api/characters", temp, "{\"n\":\"" + prefix + "\"}");
        assertEquals(201, created.statusCode());
        return new Client(cookie, json.readTree(created.body()).get("id").asText(), username);
    }

    private HttpResponse<String> rawSend(String method, String path, Client client, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body));
        if (client != null) builder.header("Cookie", client.cookie());
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private void send(String method, String path, Client client, String body) throws Exception {
        int status = rawSend(method, path, client, body).statusCode();
        assertTrue(status == 200 || status == 201 || status == 204, "HTTP " + status);
    }

    private BlockingQueue<String> sse(Client client) {
        BlockingQueue<String> lines = new LinkedBlockingQueue<>();
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/events"))
            .header("Cookie", client.cookie()).header("Accept", "text/event-stream").GET().build();
        http.sendAsync(request, HttpResponse.BodyHandlers.ofLines()).thenAccept(r -> r.body().forEach(lines::add));
        return lines;
    }

    private boolean waitFor(BlockingQueue<String> lines, String prefix) throws InterruptedException {
        return waitForLine(lines, prefix) != null;
    }

    /** prefix 줄 다음에 오는 data 줄의 내용을 반환합니다. */
    private String waitForData(BlockingQueue<String> lines, String prefix) throws InterruptedException {
        assertNotNull(waitForLine(lines, prefix), prefix + " 이벤트를 받지 못했습니다");
        String line = lines.poll(5, TimeUnit.SECONDS);
        assertNotNull(line);
        assertTrue(line.startsWith("data:"), line);
        return line.substring(5);
    }

    private String waitForLine(BlockingQueue<String> lines, String prefix) throws InterruptedException {
        long end = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < end) {
            String line = lines.poll(200, TimeUnit.MILLISECONDS);
            if (line != null && line.startsWith(prefix)) return line;
        }
        return null;
    }

    private WebSocket openSocket(Client client, BlockingQueue<JsonNode> sink) throws Exception {
        return http.newWebSocketBuilder().header("Cookie", client.cookie())
            .buildAsync(URI.create("ws://localhost:" + port + "/ws/pos"), listener(sink)).get(5, TimeUnit.SECONDS);
    }

    private WebSocket.Listener listener(BlockingQueue<JsonNode> sink) {
        return new WebSocket.Listener() {
            private final StringBuilder buffer = new StringBuilder();

            @Override
            public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
                buffer.append(data);
                if (last) {
                    try {
                        sink.add(json.readTree(buffer.toString()));
                    } catch (Exception ignored) {
                        // 테스트에서 JSON이 아닌 프레임은 무시합니다.
                    }
                    buffer.setLength(0);
                }
                webSocket.request(1);
                return null;
            }
        };
    }

    private JsonNode next(BlockingQueue<JsonNode> queue) throws InterruptedException {
        JsonNode node = queue.poll(5, TimeUnit.SECONDS);
        assertNotNull(node, "WebSocket 메시지를 받지 못했습니다");
        return node;
    }

    private String move(String id, int x, int y) throws Exception {
        return json.writeValueAsString(Map.of("id", id, "x", x, "y", y, "w", "plaza"));
    }
}
