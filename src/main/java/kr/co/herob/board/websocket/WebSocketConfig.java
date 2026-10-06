package kr.co.herob.board.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/** 위치 채널(/ws/pos)을 등록합니다. 허용 출처는 기본값(같은 출처)만 사용하고, 로그인 세션이 필요합니다. */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final PositionSocketHandler handler;

    public WebSocketConfig(PositionSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/pos");
    }
}
