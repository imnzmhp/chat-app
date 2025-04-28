# チャットアプリ

#### chatGPT の出力を参考にしています

## 構成

```
chat-app
├── client
│   └── src
│      └── App.js（メイン画面）
│      └── index.js
├── server
│   └── index.js（サーバー）
```

## 技術スタック

- フロントエンド：React + socket.io-client
- バックエンド：Node.js + Express + Socket.io

## プロジェクト作成

```bash
mkdir chat-app
cd chat-app
```

## サーバー側のセットアップ

```bash
mkdir server
cd server
npm init -y
npm install express socket.io
```

## クライアント側のセットアップ

```bash
npx create-react-app client
cd client
npm install socket.io-client
```

## 基本機能

- チャットアプリを開くとニックネーム入力画面が表示される
- ニックネームを入力するとチャット画面に移動
- ニックネームは端末ごと，ブラウザごとに保存される
- ニックネームが入力済みの場合は即座にチャット画面が表示される

## 起動

- `node server/index.js`
- `npm start`
