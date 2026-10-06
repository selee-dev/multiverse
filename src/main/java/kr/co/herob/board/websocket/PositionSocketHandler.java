package kr.co.herob.board.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import kr.co.herob.board.service.AccountService;
import kr.co.herob.board.service.PositionService;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** 캐릭터 위치(x, y)만 실시간으로 주고받는 WebSocket 핸들러입니다. 위치는 DB에 저장하지 않습니다. */
@Component
public class PositionSocketHandler extends TextWebSocketHandler {

    private static final long MIN_INTERVAL_MS = 100;
    private static final String LAST_AT = "lastAt";
    private static final String OWNED = "owned";

    private final Map<String, ConcurrentWebSocketSessionDecorator> sessions = new ConcurrentHashMap<>();
    private final PositionService positions;
    private final AccountService accounts;
    private final ObjectMapper json;

    public PositionSocketHandler(PositionService positions, AccountService accounts, ObjectMapper json) {
        this.positions = positions;
        this.accounts = accounts;
        this.json = json;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession raw) throws Exception {
        if (!(raw.getPrincipal() instanceof Authentication auth) || auth instanceof AnonymousAuthenticationToken
            || !auth.isAuthenticated()) {
            raw.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        ConcurrentWebSocketSessionDecorator session = new ConcurrentWebSocketSessionDecorator(raw, 5_000, 64 * 1024);
        sessions.put(raw.getId(), session);
        raw.getAttributes().put(OWNED, new ConcurrentHashMap<String, Boolean>());
        session.sendMessage(new TextMessage(positions.snapshot().toString()));
    }

    @Override
    protected void handleTextMessage(WebSocketSession raw, TextMessage text) throws IOException {
        long now = System.currentTimeMillis();
        Object last = raw.getAttributes().get(LAST_AT);
        if (last instanceof Long at && now - at < MIN_INTERVAL_MS) return;
        raw.getAttributes().put(LAST_AT, now);

        JsonNode message;
        try {
            message = json.readTree(text.getPayload());
        } catch (IOException e) {
            return;
        }
        String id = positions.validCharacterId(message);
        if (id == null || !mayMove(raw, id)) return;

        String data = positions.update(message).toString();
        for (Map.Entry<String, ConcurrentWebSocketSessionDecorator> entry : sessions.entrySet()) {
            if (entry.getKey().equals(raw.getId())) continue;
            try {
                entry.getValue().sendMessage(new TextMessage(data));
            } catch (Exception e) {
                sessions.remove(entry.getKey());
                try { entry.getValue().close(CloseStatus.SESSION_NOT_RELIABLE); } catch (IOException ignored) { }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    /** 관리자이거나 본인 소유 캐릭터일 때만 위치를 바꿀 수 있습니다. 소유 여부는 세션당 한 번만 조회합니다. */
    @SuppressWarnings("unchecked")
    private boolean mayMove(WebSocketSession session, String characterId) {
        Principal principal = session.getPrincipal();
        if (!(principal instanceof Authentication auth)) return false;
        if (auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        Map<String, Boolean> owned = (Map<String, Boolean>) session.getAttributes().get(OWNED);
        return owned.computeIfAbsent(characterId, id -> accounts.ownsCharacter(auth.getName(), id));
    }
}
