package kr.co.herob.board.service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/** IP와 아이디 조합별 로그인 실패 횟수를 메모리에 기록하고, 한도를 넘으면 일정 시간 잠급니다. */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    private static final Duration LOCK_TIME = Duration.ofMinutes(10);

    private record Attempt(int failures, long lockedUntil) {}

    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();

    /** 현재 잠겨 있는 키인지 확인합니다. 잠금이 끝났으면 기록을 지웁니다. */
    public boolean isLocked(String key) {
        Attempt attempt = attempts.get(key);
        if (attempt == null || attempt.lockedUntil() == 0) return false;
        if (System.currentTimeMillis() < attempt.lockedUntil()) return true;
        attempts.remove(key, attempt);
        return false;
    }

    /** 실패를 기록하고, 한도에 도달하면 잠금 시각을 설정합니다. */
    public void recordFailure(String key) {
        long now = System.currentTimeMillis();
        attempts.merge(key, new Attempt(1, 0), (old, ignored) -> {
            if (old.lockedUntil() != 0 && now >= old.lockedUntil()) return new Attempt(1, 0);
            int failures = old.failures() + 1;
            return new Attempt(failures, failures >= MAX_FAILURES ? now + LOCK_TIME.toMillis() : old.lockedUntil());
        });
    }

    /** 로그인에 성공하면 해당 키의 실패 기록을 지웁니다. */
    public void reset(String key) {
        attempts.remove(key);
    }
}
