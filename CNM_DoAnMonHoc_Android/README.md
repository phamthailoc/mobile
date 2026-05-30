# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Project notes

Frontend files were updated to keep Android/web chat behavior aligned:

- Attachment rendering now detects images and videos from MIME type, filename, and S3 URL instead of relying only on `fileType === 'image'`.
- Android-sent attachments are normalized with `msgType` so the web can render them as media instead of plain file cards.
- Pinned messages now have a top summary strip and a pinned-messages modal on Android to match the web layout more closely.

## Environment

Create a local `.env` file in the Android project root.

Required variable:

- `EXPO_PUBLIC_API_URL=https://ngochien-ott.duckdns.org`
- `EXPO_PUBLIC_SOCKET_URL=https://ngochien-ott.duckdns.org` (optional, defaults to `EXPO_PUBLIC_API_URL`)

This app does not need AWS or Firebase secrets in the Android `.env`; those stay in the backend.

If you continue the chat work, check `CNM_DoAnMonHoc_Frontend/src/components/chat/MessageItem.jsx` first for media rendering, and the Android chat screen for the send-side message shape.npx expo start -cnpx expo start -cnpx expo start -c

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
