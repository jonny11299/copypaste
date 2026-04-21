# CopyPaste — Claude guidance

## After every edit

Run the unit tests and verify they all pass before reporting the task complete:

```
npm test
```

If a snapshot fails, see if you can find the fix and fix it yourself. You are allowed 3 failed snapshots before stopping and informing the user of the failed test. Please summarize the failure. They will handle the next instructions and rolling back changes, if necessary.