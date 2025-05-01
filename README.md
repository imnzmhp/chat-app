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
│       └── models
│           └── User.js
│       └── routes
│           └── auth.js
```

## 技術スタック

- フロントエンド：React + socket.io-client
- バックエンド：Node.js + Express + Socket.io + mongoDB

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
npm install express socket.io mongoose cors
```

## mongoDB のセットアップ

- homebrew でインストール

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
```

- MongoDB サーバーを起動

```bash
brew services start mongodb-community@7.0
```

- 停止

```bash
brew services stop mongodb-community@7.0
```

## クライアント側のセットアップ

```bash
npx create-react-app client
cd client
npm install socket.io-client axios
```

## mongoDB の見方

- mongoDB シェルに入る

```bash
mongosh
```

- データベースを選択

```bash
use chatapp
```

- コレクション一覧を表示

```bash
show collections
```

- 中身を見る
  - 例：ユーザー一覧を見る

```bash
db.users.find().pretty()
```

- 削除

```bash
// ルームを一つ削除
db.rooms.deleteOne({ roomName: "room1" });

// ルームの全メッセージ削除
db.messages.deleteMany({ roomId: "..." });

// _idで削除したい場合
db.users.deleteOne({ _id: ObjectId("0123...") });

```

- 終了

```bash
exit
```

## 基本機能

- ユーザー管理
  - Discriminator 型（例：user#0123）
  - ユーザーネーム + パスワードによるログイン・ログアウト
- ルーム管理
  - ルームを作成可能
  - ルームの作成者のみルーム削除可能
  - 誰もいないルームは一定時間後に自動削除
- メッセージ管理
  - 再入室してもメッセージの履歴をタイムスタンプ付きで表示

## 起動

- server 側
  - `node index.js`
- client 側
  - `npm start`

```

```
