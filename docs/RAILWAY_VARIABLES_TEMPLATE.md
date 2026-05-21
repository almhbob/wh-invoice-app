# Railway Variables Template

Add these variables in Railway -> Variables.

```text
EXPO_PUBLIC_FIREBASE_API_KEY=<from Firebase web app config>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id.firebaseapp.com>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<project-id.appspot.com>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
EXPO_PUBLIC_FIREBASE_APP_ID=<web-app-id>
EXPO_PUBLIC_APP_ENV=production
```

After adding or changing variables, redeploy the service.

Verify:

```text
https://fawtara.sawihasa.digital/healthz
```

Then open the system:

```text
https://fawtara.sawihasa.digital?refresh=latest
```
