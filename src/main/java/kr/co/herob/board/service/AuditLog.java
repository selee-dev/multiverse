package kr.co.herob.board.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** 로그인, 승인, 권한 거부 같은 보안 이벤트를 사용자·IP와 함께 별도 로거(audit)에 남깁니다. 비밀번호와 본문은 기록하지 않습니다. */
@Component
public class AuditLog {

    private static final Logger log = LoggerFactory.getLogger("audit");

    /** 현재 요청의 IP를 붙여 한 줄로 기록합니다. */
    public void record(String event, String user, String detail) {
        log.info("event={} user={} ip={} detail={}", event, clean(user), clientIp(), clean(detail));
    }

    private static String clientIp() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
            ? attributes.getRequest().getRemoteAddr() : "-";
    }

    /** 로그 줄을 위조할 수 있는 개행 문자를 제거하고 길이를 제한합니다. */
    private static String clean(String value) {
        if (value == null || value.isEmpty()) return "-";
        String flat = value.replaceAll("[\\r\\n\\t]", " ");
        return flat.length() > 100 ? flat.substring(0, 100) : flat;
    }
}
