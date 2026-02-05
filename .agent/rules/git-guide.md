---
trigger: always_on
---

# Git Guide & Convention
**모든 개발 작업 시 아래의 Branch 및 Commit 규칙을 엄격히 준수해야 합니다.**

## 1. 🌿 Git Branch Strategy (Git-flow)
- **main:** 운영 배포용 (**직접 Commit/Push 절대 금지**)
- **develop:** 차기 개발버전 통합용 (**직접 Commit/Push 금지**, Merge Request로만 통합)
- **feat/{name}:** 기능 개발용 (예: `feat/user-login`)
- **fix/{name}:** 버그 수정용 (예: `fix/token-error`)
- **hotfix/{name}:** 운영 긴급 수정용

### [중요] 브랜치 생성 규칙
1. 브랜치명은 **소문자**와 **하이픈(-)**만을 사용하는 **Kebab Case**를 따릅니다.
2. 기능 개발 시작 전, 반드시 `develop` 브랜치에서 `git pull`을 수행하여 최신 상태를 동기화한 후 브랜치를 생성하십시오.

## 2. 💬 Git Commit Convention
커밋 메시지는 다음 템플릿을 따릅니다. 메시지 언어는 **한국어**를 사용합니다.
```
<Type>: <Subject>  (최대 50자)
<Content>          (선택사항, 어떻게/왜 변경했는지 상세 설명)
<Footer>           (선택사항, 이슈 트래킹 ID 등)
```

### Type (Header 접두사)
- feat: 새로운 기능 추가
- fix: 버그 수정
- refactor: 기능 변경 없는 코드 구조 개선
- style: 코드 포맷팅, 세미콜론 누락 등 (비즈니스 로직 변경 없음)
- docs: 문서 수정
- test: 테스트 코드 추가/수정
- chore: 빌드 설정, 패키지 매니저 설정 등
- revert: 커밋 되돌리기

### 작성 예시
- `git commit -m "feat: 사용자 로그인 API 구현" -m "JWT 토큰 발급 로직 추가 및 Redis 연동 완료" -m "Resolves: #101"`

[Agent Action Guide]
복잡한 변경 사항은 한 번에 커밋하지 말고, 논리적 단위로 쪼개서(Atomic Commit) 여러 번 커밋하십시오.
커밋 메시지 작성 시 -m 옵션을 여러 번 사용하여 제목과 본문을 분리하는 방식을 권장합니다.