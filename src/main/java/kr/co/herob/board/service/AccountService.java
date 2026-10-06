package kr.co.herob.board.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** 계정 인증 데이터와 캐릭터의 등록·조회·수정·삭제를 처리합니다. */
@Service
public class AccountService implements UserDetailsService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);
    private static final Pattern USERNAME = Pattern.compile("[a-z0-9_-]{3,30}");
    private static final Set<String> UNIVERSES = Set.of(
        "order", "member", "display", "broadcast", "curation", "fgen",
        "bord", "bprod", "blog", "bsettle", "bgen");
    private static final RowMapper<HeroCharacter> CHARACTER_ROW = AccountService::mapCharacter;

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper json;

    private final String adminUsername;
    private final String adminPassword;

    public AccountService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, ObjectMapper json,
                          @Value("${app.admin.username:admin}") String adminUsername,
                          @Value("${app.admin.password:}") String adminPassword) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.json = json;
        this.adminUsername = normalizeUsername(adminUsername);
        this.adminPassword = adminPassword;
    }

    /** 저장된 계정 정보를 Spring Security의 사용자 형식으로 조회합니다. */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        List<UserDetails> users = jdbc.query(
            "SELECT USERNAME, PASSWORD_HASH, ROLE_NAME FROM HERO_ACCOUNT WHERE USERNAME = ?",
            (rs, rowNum) -> User.withUsername(rs.getString("USERNAME"))
                .password(rs.getString("PASSWORD_HASH"))
                .roles(rs.getString("ROLE_NAME"))
                .build(), normalizeUsername(username));
        if (users.isEmpty()) throw new UsernameNotFoundException("계정을 찾을 수 없습니다.");
        return users.get(0);
    }

    /** 관리자 비밀번호가 설정돼 있고 해당 계정이 없을 때만 관리자 계정을 추가합니다. */
    public void ensureAdmin() {
        try {
            jdbc.execute("ALTER TABLE HERO_CHARACTER DROP CONSTRAINT IF EXISTS HERO_CHARACTER_OWNER_ID_KEY");
        } catch (org.springframework.dao.DataAccessException ignored) {
            // 새 스키마에는 이미 중복 소유자를 허용하므로 마이그레이션 실패를 시작 장애로 만들지 않습니다.
        }
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("APP_ADMIN_PASSWORD가 설정되지 않아 관리자 계정을 생성하지 않습니다.");
            return;
        }
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM HERO_ACCOUNT WHERE USERNAME = ?",
            Integer.class, adminUsername);
        if (count == null || count == 0) {
            jdbc.update("INSERT INTO HERO_ACCOUNT (USERNAME, PASSWORD_HASH, ROLE_NAME) VALUES (?, ?, ?)",
                adminUsername, passwordEncoder.encode(adminPassword), "ADMIN");
        }
    }

    /** 가입할 수 없는 관리자 아이디인지 확인합니다. 기존 "admin" 예약도 유지합니다. */
    private boolean isReservedUsername(String username) {
        return "admin".equals(username) || adminUsername.equals(username);
    }

    /** 입력값을 검증하고 일반 사용자 계정을 생성합니다. */
    public String register(String rawUsername, String password) {
        String username = normalizeUsername(rawUsername);
        if (!USERNAME.matcher(username).matches() || isReservedUsername(username)) {
            throw new IllegalArgumentException("아이디는 영문 소문자, 숫자, _, - 조합 3~30자로 입력해 주세요.");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("비밀번호를 입력해 주세요.");
        }
        try {
            jdbc.update("INSERT INTO HERO_ACCOUNT (USERNAME, PASSWORD_HASH, ROLE_NAME) VALUES (?, ?, ?)",
                username, passwordEncoder.encode(password), "USER");
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다.");
        }
        return username;
    }

    /** 아이디 형식과 예약어, 저장된 계정을 확인해 가입 가능 여부를 반환합니다. */
    public boolean isUsernameAvailable(String rawUsername) {
        String username = normalizeUsername(rawUsername);
        if (!USERNAME.matcher(username).matches() || isReservedUsername(username)) return false;
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM HERO_ACCOUNT WHERE USERNAME = ?", Integer.class, username);
        return count != null && count == 0;
    }

    /** 일반 로그인 사용자의 공지 권한을 캐릭터 직급으로 확인합니다. */
    public boolean hasAnnouncementRank(String username) {
        if (username == null) return false;
        String owner = normalizeUsername(username);
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM HERO_CHARACTER "
            + "WHERE OWNER_ID = ? AND TITLE IN ('팀장', '상무')", Integer.class, owner);
        if (count != null && count > 0) return true;
        List<String> titles = jdbc.query("SELECT D.BODY FROM HERO_DOC D JOIN HERO_CHARACTER C "
            + "ON C.CHARACTER_ID = D.DOC_ID WHERE D.COL_NAME = 'titles' AND C.OWNER_ID = ?",
            (rs, rowNum) -> rs.getString(1), owner);
        for (String body : titles) {
            try {
                String title = json.readTree(body).path("t").asText();
                if ("팀장".equals(title) || "상무".equals(title)) return true;
            } catch (Exception ignored) {
                // 손상된 직급 문서는 권한 부여에 사용하지 않습니다.
            }
        }
        return false;
    }

    /** 계정 이름을 정규화해 수신자 계정이 실제로 존재하는지 확인합니다. */
    public boolean accountExists(String username) {
        String normalized = normalizeUsername(username);
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM HERO_ACCOUNT WHERE USERNAME = ?", Integer.class, normalized);
        return count != null && count > 0;
    }

    /** 개인·그룹 채팅 연락처로 다른 모든 계정을 캐릭터 정보와 함께 조회합니다. */
    public List<Map<String, Object>> privateChatContacts(String currentUsername) {
        return jdbc.query("SELECT A.USERNAME, C.NICKNAME, C.CHARACTER_ID FROM HERO_ACCOUNT A "
            + "JOIN HERO_CHARACTER C ON C.OWNER_ID = A.USERNAME WHERE A.USERNAME <> ? ORDER BY A.USERNAME",
            (rs, rowNum) -> {
                String username = rs.getString("USERNAME");
                Map<String, Object> contact = new java.util.LinkedHashMap<>();
                contact.put("username", username);
                contact.put("name", rs.getString("NICKNAME") == null ? username : rs.getString("NICKNAME"));
                contact.put("characterId", rs.getString("CHARACTER_ID"));
                return contact;
            }, normalizeUsername(currentUsername));
    }

    /** 등록된 모든 캐릭터를 생성 순서로 조회합니다. */
    public List<HeroCharacter> characters() {
        return jdbc.query("SELECT CHARACTER_ID, OWNER_ID, NICKNAME, GENDER, TITLE, UNIVERSE, JOB "
            + "FROM HERO_CHARACTER ORDER BY CREATED_AT, OWNER_ID", CHARACTER_ROW);
    }

    /** 관리자 매핑 화면에 표시할 모든 계정과 캐릭터 수를 조회합니다. */
    public List<Map<String, Object>> adminAccounts() {
        return jdbc.query("SELECT A.USERNAME, COUNT(C.CHARACTER_ID) AS CHARACTER_COUNT "
                + "FROM HERO_ACCOUNT A LEFT JOIN HERO_CHARACTER C ON C.OWNER_ID = A.USERNAME "
                + "GROUP BY A.USERNAME ORDER BY A.USERNAME",
            (rs, rowNum) -> Map.of("username", rs.getString("USERNAME"),
                "characterCount", rs.getInt("CHARACTER_COUNT")));
    }

    /** 일반 계정은 하나, 관리자는 여러 개의 캐릭터를 검증 후 생성합니다. */
    public HeroCharacter createCharacter(String username, boolean allowMultiple, Map<String, String> input) {
        CharacterFields fields = validateFields(input, null);
        String id = "char" + UUID.randomUUID().toString().replace("-", "");
        if (!allowMultiple && characterIdFor(username) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "계정당 캐릭터는 하나만 생성할 수 있습니다.");
        }
        try {
            jdbc.update("INSERT INTO HERO_CHARACTER "
                + "(CHARACTER_ID, OWNER_ID, NICKNAME, GENDER, TITLE, UNIVERSE, JOB) VALUES (?, ?, ?, ?, ?, ?, ?)",
                id, username, fields.name(), fields.gender(), fields.title(), fields.universe(), fields.job());
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "캐릭터를 생성할 수 없습니다.");
        }
        return new HeroCharacter(id, username, fields.name(), fields.gender(), fields.title(),
            fields.universe(), fields.job(), true);
    }

    /** 캐릭터 소유자 또는 관리자의 권한을 확인한 뒤 캐릭터를 갱신합니다. */
    public HeroCharacter updateCharacter(String id, String username, boolean admin, Map<String, String> input) {
        HeroCharacter existing = findCharacter(id);
        requireOwnerOrAdmin(existing, username, admin);
        CharacterFields fields = validateFields(input, existing);
        jdbc.update("UPDATE HERO_CHARACTER SET NICKNAME = ?, GENDER = ?, TITLE = ?, UNIVERSE = ?, JOB = ? "
                + "WHERE CHARACTER_ID = ?", fields.name(), fields.gender(), fields.title(), fields.universe(), fields.job(), id);
        return new HeroCharacter(id, existing.ownerId(), fields.name(), fields.gender(), fields.title(),
            fields.universe(), fields.job(), true);
    }

    /** 권한을 확인하고 캐릭터와 해당 계정의 문서를 제거합니다. */
    public void deleteCharacter(String id, String username, boolean admin) {
        HeroCharacter existing = findCharacter(id);
        requireOwnerOrAdmin(existing, username, admin);
        jdbc.update("DELETE FROM HERO_CHARACTER WHERE CHARACTER_ID = ?", id);
        jdbc.update("DELETE FROM HERO_DOC WHERE DOC_ID = ?", id);
    }

    /** 지정한 계정이 해당 캐릭터의 소유자인지 확인합니다. */
    public boolean ownsCharacter(String username, String id) {
        if (username == null || id == null) return false;
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM HERO_CHARACTER WHERE OWNER_ID = ? AND CHARACTER_ID = ?",
            Integer.class, username, id);
        return count != null && count > 0;
    }

    /** 계정에 연결된 캐릭터 ID를 반환하거나 없으면 null을 반환합니다. */
    public String characterIdFor(String username) {
        List<String> ids = jdbc.query("SELECT CHARACTER_ID FROM HERO_CHARACTER WHERE OWNER_ID = ?",
            (rs, rowNum) -> rs.getString(1), username);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private HeroCharacter findCharacter(String id) {
        List<HeroCharacter> found = jdbc.query("SELECT CHARACTER_ID, OWNER_ID, NICKNAME, GENDER, TITLE, UNIVERSE, JOB "
            + "FROM HERO_CHARACTER WHERE CHARACTER_ID = ?", CHARACTER_ROW, id);
        if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "캐릭터를 찾을 수 없습니다.");
        return found.get(0);
    }

    private static void requireOwnerOrAdmin(HeroCharacter character, String username, boolean admin) {
        if (!admin && !character.ownerId().equals(username)) throw new AccessDeniedException("캐릭터 소유자만 수정할 수 있습니다.");
    }

    private static CharacterFields validateFields(Map<String, String> input, HeroCharacter existing) {
        String name = value(input, "n", existing == null ? null : existing.n()).trim();
        String gender = value(input, "g", existing == null ? "m" : existing.g());
        String title = value(input, "t", existing == null ? "" : existing.t()).trim();
        String universe = value(input, "u", existing == null ? "order" : existing.u());
        String job = value(input, "c", existing == null ? "팀원" : existing.c()).trim();
        if (name.isBlank() || name.length() > 30) throw new IllegalArgumentException("캐릭터 이름은 1~30자로 입력해 주세요.");
        if (!"m".equals(gender) && !"f".equals(gender)) throw new IllegalArgumentException("성별 값이 올바르지 않습니다.");
        if (title.length() > 8 || job.length() > 16) throw new IllegalArgumentException("직급 또는 직업의 길이가 너무 깁니다.");
        if (!UNIVERSES.contains(universe)) throw new IllegalArgumentException("유니버스 값이 올바르지 않습니다.");
        return new CharacterFields(name, gender, title, universe, job.isBlank() ? "팀원" : job);
    }

    private static String value(Map<String, String> input, String key, String fallback) {
        String value = input == null ? null : input.get(key);
        return value == null ? fallback : value;
    }

    private static String normalizeUsername(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static HeroCharacter mapCharacter(ResultSet rs, int rowNum) throws SQLException {
        return new HeroCharacter(rs.getString("CHARACTER_ID"), rs.getString("OWNER_ID"),
            rs.getString("NICKNAME"), rs.getString("GENDER"), rs.getString("TITLE"),
            rs.getString("UNIVERSE"), rs.getString("JOB"), true);
    }

    private record CharacterFields(String name, String gender, String title, String universe, String job) {}
}