@AGENTS.md

## Kritik kurallar (disclarion)

- **Duplicate-isimli dosya/klasör ASLA oluşturulmaz veya commit edilmez**: adında boşluk + rakam olan isimler (`page 2.tsx`, `utils 3.ts`, `components 2`) iCloud/Finder çakışma kopyasıdır. Görürsen DUR ve kullanıcıya bildir; asla `.gitignore` ile gizleme. Koruma: CI (`scripts/check-duplicate-names.sh`), pre-commit (`.githooks/pre-commit`, her klonda `sh scripts/setup-git-hooks.sh`), Claude Code hook (`.claude/hooks/block-duplicate-names.py`).
