package kr.co.herob.board.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 문서 변경을 구독 중인 브라우저에 SSE 이벤트로 전달합니다.
 * 모든 이벤트에는 단조 증가하는 seq가 붙어, 클라이언트가 누락을 감지하면 전체를 다시 조회합니다.
 */
@Service
public class DocEventService {

    private record Subscriber(String username, SseEmitter emitter) {}

    private final List<Subscriber> subscribers = new CopyOnWriteArrayList<>();
    private final AtomicLong seq = new AtomicLong();
    private final ObjectMapper json;

    public DocEventService(ObjectMapper json) {
        this.json = json;
    }

    /** 새 SSE 구독자를 등록하고, 현재 seq를 담은 connected 이벤트를 보냅니다. */
    public synchronized void add(String username, SseEmitter emitter) {
        Subscriber subscriber = new Subscriber(username, emitter);
        subscribers.add(subscriber);
        ObjectNode hello = json.createObjectNode().put("seq", seq.get());
        send(subscriber, "connected", hello.toString());
    }

    /** 완료되거나 끊어진 SSE 구독자를 목록에서 제거합니다. */
    public void remove(SseEmitter emitter) {
        subscribers.removeIf(s -> s.emitter() == emitter);
    }

    /** 문서 하나의 변경(set/delete)을 모든 구독자에게 보냅니다. */
    public synchronized void emitDoc(String op, String col, String id, JsonNode body) {
        ObjectNode event = json.createObjectNode().put("seq", seq.incrementAndGet());
        event.put("op", op).put("col", col).put("id", id);
        if (body != null) event.set("body", body);
        String data = event.toString();
        for (Subscriber s : subscribers) send(s, "doc", data);
    }

    /** 비공개 메시지를 참여자(participants)에게만 보냅니다. */
    public synchronized void emitPrivate(ObjectNode message) {
        ObjectNode event = json.createObjectNode().put("seq", seq.incrementAndGet());
        event.set("message", message);
        String data = event.toString();
        String seqOnly = json.createObjectNode().put("seq", seq.get()).toString();
        for (Subscriber s : subscribers) {
            boolean member = false;
            for (JsonNode participant : message.path("participants")) {
                if (participant.asText().equals(s.username())) member = true;
            }
            // 비참여자에게는 내용 없이 seq만 보내 클라이언트가 누락으로 오인하지 않게 합니다.
            if (member) send(s, "private", data);
            else send(s, "seq", seqOnly);
        }
    }

    /** 델타로 표현할 수 없는 변경(계정·캐릭터 등)은 전체 새로고침을 요청합니다. */
    public synchronized void emitRefresh() {
        String data = json.createObjectNode().put("seq", seq.incrementAndGet()).toString();
        for (Subscriber s : subscribers) send(s, "refresh", data);
    }

    /** 프록시가 유휴 연결을 끊지 않도록 주기적으로 주석 이벤트를 보냅니다. */
    @Scheduled(fixedRate = 25_000)
    public synchronized void heartbeat() {
        for (Subscriber s : subscribers) {
            try {
                s.emitter().send(SseEmitter.event().comment("hb"));
            } catch (IOException | IllegalStateException e) {
                subscribers.remove(s);
            }
        }
    }

    private void send(Subscriber subscriber, String name, String data) {
        try {
            subscriber.emitter().send(SseEmitter.event().name(name).data(data));
        } catch (IOException | IllegalStateException e) {
            subscribers.remove(subscriber);
        }
    }
}
