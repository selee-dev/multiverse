package kr.co.herob.board.service;

import java.util.Set;
import kr.co.herob.board.service.AccountService;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/** 현재 세션의 사용자 정보와 문서별 쓰기 권한을 판정합니다. */
@Service
public class AuthService {

    private static final Set<String> CHARACTER_COLLECTIONS = Set.of(
        "nicks", "titles", "skills", "stats", "health", "tasks", "pres", "ot", "seats", "status", "jobs", "moves", "say");
    private static final Set<String> SHARED_OPERATION_COLLECTIONS = Set.of("meetings", "snacks", "projects");

    private final AccountService accounts;

    public AuthService(AccountService accounts) {
        this.accounts = accounts;
    }

    /** 인증된 사용자의 로그인 이름을 반환하고 익명 세션이면 null을 반환합니다. */
    public String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken ? null : auth.getName();
    }

    /** 현재 사용자의 역할 이름을 ROLE_ 접두사 없이 반환합니다. */
    public String currentRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
        return auth.getAuthorities().stream().map(a -> a.getAuthority())
            .filter(a -> a.startsWith("ROLE_")).map(a -> a.substring(5)).findFirst().orElse("USER");
    }

    /** 현재 사용자가 관리자 역할인지 확인합니다. */
    public boolean isAdmin() {
        return "ADMIN".equals(currentRole());
    }

    /** 관리자 또는 팀장·상무 직급 캐릭터의 소유자에게 공지 권한을 부여합니다. */
    public boolean canAnnounce() {
        return isAdmin() || accounts.hasAnnouncementRank(currentUser());
    }

    /** 관리자는 전체, 일반 사용자는 공용 운영 문서와 본인 캐릭터 문서만 쓸 수 있는지 판정합니다. */
    public boolean canWriteDocument(String collection, String id) {
        if (isAdmin()) return true;
        String username = currentUser();
        if ("chat".equals(collection)) return username != null && accounts.hasAnnouncementRank(username);
        return username != null && (SHARED_OPERATION_COLLECTIONS.contains(collection)
            || CHARACTER_COLLECTIONS.contains(collection) && accounts.ownsCharacter(username, id));
    }

    /** 현재 사용자의 캐릭터 ID를 반환하고 로그인하지 않았으면 null을 반환합니다. */
    public String currentCharacterId() {
        String username = currentUser();
        return username == null ? null : accounts.characterIdFor(username);
    }
}
