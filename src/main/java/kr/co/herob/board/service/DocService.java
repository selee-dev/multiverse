package kr.co.herob.board.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import kr.co.herob.board.mapper.DocMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 문서 컬렉션과 ID를 검증하고 DB JSON 문서를 읽고 씁니다. */
@Service
public class DocService {

    /** 화면(js/app.js)이 쓰는 컬렉션 이름. 목록에 없는 이름은 거부합니다. */
    public static final Set<String> COLLECTIONS = Set.of(
        "people", "nicks", "titles", "skills", "stats", "health", "tasks", "pres", "ot", "seats",
        "meetings", "projects", "snacks", "chat", "cfg", "jobs", "moves", "status", "pos");

    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,60}");
    private static final int MAX_BODY = 100_000;

    private final DocMapper mapper;
    private final AccountService accounts;
    private final ObjectMapper json;

    public DocService(DocMapper mapper, AccountService accounts, ObjectMapper json) {
        this.mapper = mapper;
        this.accounts = accounts;
        this.json = json;
    }

    /** 전체 문서: { 컬렉션: { 문서id: 내용 } } */
    @Transactional(readOnly = true)
    public ObjectNode findAll() {
        ObjectNode root = json.createObjectNode();
        COLLECTIONS.forEach(c -> root.putObject(c));
        for (DocRow r : mapper.selectAll()) {
            if (!root.has(r.col())) continue;
            try {
                ((ObjectNode) root.get(r.col())).set(r.id(), json.readTree(r.body()));
            } catch (JsonProcessingException ignore) {
                // 깨진 JSON 행은 건너뜁니다.
            }
        }
        ObjectNode main = ((ObjectNode) root.get("people")).with("main");
        ArrayNode members = main.withArray("list");
        List<HeroCharacter> activeCharacters = accounts.characters();
        Set<String> activeCharacterIds = activeCharacters.stream()
            .map(HeroCharacter::id).collect(java.util.stream.Collectors.toSet());
        for (int i = members.size() - 1; i >= 0; i--) {
            JsonNode member = members.get(i);
            String memberId = member.path("id").asText();
            boolean accountCharacter = member.path("accountCharacter").asBoolean(false)
                || memberId.startsWith("char");
            if (accountCharacter
                && !activeCharacterIds.contains(member.path("id").asText())) members.remove(i);
        }
        Set<String> knownIds = new java.util.HashSet<>();
        members.forEach(member -> {
            if (member.hasNonNull("id")) knownIds.add(member.get("id").asText());
        });
        for (HeroCharacter character : activeCharacters) {
            if (!knownIds.contains(character.id())) {
                ObjectNode member = json.createObjectNode();
                member.put("id", character.id());
                member.put("n", character.n());
                member.put("g", character.g());
                member.put("t", character.t());
                member.put("u", character.u());
                member.put("c", character.c());
                member.put("accountCharacter", true);
                members.add(member);
            }
        }
        return root;
    }

    /** 저장 (있으면 수정, 없으면 추가). Oracle/H2 어디서나 동작하도록 MERGE 대신 update → insert 로 처리합니다. */
    @Transactional
    public void save(String col, String id, JsonNode body) {
        check(col, id);
        if (body == null || !body.isObject()) throw new IllegalArgumentException("본문은 JSON 객체여야 합니다.");
        String text = body.toString();
        if (text.length() > MAX_BODY) throw new IllegalArgumentException("본문이 너무 큽니다.");
        if (mapper.update(col, id, text) == 0) mapper.insert(col, id, text);
    }

    /** 공용 설정의 사장님 방문 상태만 갱신하고 나머지 설정은 보존합니다. */
    @Transactional
    public void setBossVisit(boolean enabled) {
        ObjectNode config = json.createObjectNode();
        for (DocRow row : mapper.selectByCollection("cfg")) {
            if (!"main".equals(row.id())) continue;
            try {
                JsonNode existing = json.readTree(row.body());
                if (existing != null && existing.isObject()) config = (ObjectNode) existing;
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("공용 설정 문서를 읽을 수 없습니다.", e);
            }
            break;
        }
        config.put("bossVisit", enabled);
        save("cfg", "main", config);
    }

    @Transactional
    public void remove(String col, String id) {
        check(col, id);
        mapper.delete(col, id);
    }

    private void check(String col, String id) {
        if (!COLLECTIONS.contains(col)) throw new IllegalArgumentException("알 수 없는 컬렉션: " + col);
        if (id == null || !ID.matcher(id).matches()) throw new IllegalArgumentException("잘못된 문서 id");
    }
}
