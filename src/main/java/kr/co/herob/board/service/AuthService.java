package kr.co.herob.board.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import kr.co.herob.board.mapper.DocMapper;
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
    private final DocMapper mapper;
    private final ObjectMapper json;

    public AuthService(AccountService accounts, DocMapper mapper, ObjectMapper json) {
        this.accounts = accounts;
        this.mapper = mapper;
        this.json = json;
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
        // 광장 대화 기록은 "<캐릭터id>_<시각>" 형식 id의 앞부분 캐릭터를 본인이 소유할 때만 쓸 수 있습니다.
        if ("saylog".equals(collection)) {
            int cut = id == null ? -1 : id.indexOf('_');
            return username != null && cut > 0 && accounts.ownsCharacter(username, id.substring(0, cut));
        }
        // 회의·프로젝트는 누구나 만들 수 있지만, 이미 있는 것은 그 회의 참석자·프로젝트 인원만 수정·삭제할 수 있습니다(인원이 비어 있으면 누구나).
        if ("meetings".equals(collection) || "projects".equals(collection)) {
            return username != null && canManageGroupDoc(collection, id, username);
        }
        return username != null && (SHARED_OPERATION_COLLECTIONS.contains(collection)
            || CHARACTER_COLLECTIONS.contains(collection) && accounts.ownsCharacter(username, id));
    }

    /** 문서가 아직 없으면 true(새로 만들기), 있으면 사용자가 소유한 캐릭터가 참석자·인원에 들어 있을 때만 true입니다. */
    private boolean canManageGroupDoc(String collection, String id, String username) {
        for (DocRow row : mapper.selectByCollection(collection)) {
            if (!row.id().equals(id)) continue;
            try {
                JsonNode body = json.readTree(row.body());
                JsonNode members = "meetings".equals(collection) ? body.path("m") : body.path("members");
                // 인원이 한 명도 없는 문서는 관리할 사람이 없으니 누구나 정리할 수 있게 둡니다.
                if (!members.isArray() || members.isEmpty()) return true;
                for (JsonNode member : members) {
                    String memberId = member.isObject() ? member.path("id").asText() : member.asText();
                    if (accounts.ownsCharacter(username, memberId)) return true;
                }
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                return false;
            }
            return false;
        }
        return true;
    }

    /** 현재 사용자의 캐릭터 ID를 반환하고 로그인하지 않았으면 null을 반환합니다. */
    public String currentCharacterId() {
        String username = currentUser();
        return username == null ? null : accounts.characterIdFor(username);
    }
}
