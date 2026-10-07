# AI Usage Log

| Task | What I asked the AI | Context I gave | What I kept | What I changed and why | How I verified |
| --- | --- | --- | --- | --- | --- |
| Constitution | Generate project principles with /speckit-constitution | 10 principles I wrote (scope, layers, API, testing, security, Git) | All 10 principles + workflow gates | — | Read the file and checked all 10 principles are present |
| Spec | Generate spec with /speckit-specify | My feature list, rules, out-of-scope list | 6 stories, 33 scenarios, 25 requirements | Reviewed 10 default assumptions and accepted them | Checked rules match my description; quality checklist passed |
| Plan | Generate technical plan with /speckit-plan | Stack, layers, tables, endpoints, frontend structure | Plan, data model, API contracts | — | Constitution Check passed; reviewed endpoints and tables |
| Tasks | Generate task list with /speckit-tasks | Plan, spec, one-commit-per-task rule | 42 tasks in 7 phases with commit messages | — | Checked every user story has backend + frontend tasks |