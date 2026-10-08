package kr.co.herob.board.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** 캐릭터 위치를 메모리에만 보관하고, WebSocket으로 받은 위치 메시지를 검증합니다. */
@Service
public class PositionService {

    static final double MAX_X = 1200, MAX_Y = 970;
    static final long TTL_MS = 12L * 3600 * 1000;
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,60}");
    private static final Pattern THEME = Pattern.compile("[a-z]{1,20}");

    private record Pos(String id, double x, double y, long t, String w) {}

    private final Map<String, Pos> positions = new ConcurrentHashMap<>();
    private final ObjectMapper json;

    public PositionService(ObjectMapper json) {
        this.json = json;
    }

    /** 클라이언트가 보낸 {id,x,y,w}를 검증합니다. 올바르면 캐릭터 id를, 아니면 null을 반환합니다. */
    public String validCharacterId(JsonNode message) {
        if (message == null || !message.isObject()) return null;
        JsonNode id = message.get("id"), x = message.get("x"), y = message.get("y"), w = message.get("w");
        if (id == null || !id.isTextual() || !ID.matcher(id.asText()).matches()) return null;
        if (w == null || !w.isTextual() || !THEME.matcher(w.asText()).matches()) return null;
        if (x == null || y == null || !x.isNumber() || !y.isNumber()) return null;
        double dx = x.asDouble(), dy = y.asDouble();
        if (!Double.isFinite(dx) || !Double.isFinite(dy) || dx < 0 || dy < 0 || dx > MAX_X || dy > MAX_Y) return null;
        return id.asText();
    }

    /** 검증된 위치를 서버 시각과 함께 저장하고 브로드캐스트할 메시지를 만듭니다. */
    public ObjectNode update(JsonNode message) {
        long now = System.currentTimeMillis();
        Pos pos = new Pos(message.get("id").asText(), Math.round(message.get("x").asDouble()),
            Math.round(message.get("y").asDouble()), now, message.get("w").asText());
        positions.put(pos.id(), pos);
        ObjectNode node = toNode("pos", pos, now);
        // 인사 같은 일회성 동작은 저장하지 않고 이번 브로드캐스트에만 실어 보냅니다.
        if ("bow".equals(message.path("e").asText())) node.put("e", "bow");
        return node;
    }

    /** 새로 접속한 클라이언트에게 보낼 현재 위치 목록입니다. 각 항목에 경과 시간(age)을 담습니다. */
    public ObjectNode snapshot() {
        long now = System.currentTimeMillis();
        ObjectNode root = json.createObjectNode().put("type", "snapshot");
        ArrayNode list = root.putArray("list");
        positions.values().removeIf(p -> now - p.t() >= TTL_MS);
        positions.values().forEach(p -> list.add(toNode(null, p, now)));
        return root;
    }

    /** 캐릭터가 삭제될 때 저장된 위치를 지웁니다. */
    public void remove(String characterId) {
        positions.remove(characterId);
    }

    private ObjectNode toNode(String type, Pos p, long now) {
        ObjectNode node = json.createObjectNode();
        if (type != null) node.put("type", type);
        node.put("id", p.id()).put("x", p.x()).put("y", p.y()).put("t", p.t()).put("w", p.w()).put("age", now - p.t());
        return node;
    }
}
