import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Films from "./models/Films.js";
import User from "./models/User.js"
import express from "express"

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
mongoose.connect(process.env.MONGO_URI, {});

const OWNER_ID = Number(process.env.OWNER_ID);
const ADMIN_ID = Number(process.env.ADMIN_ID)
const filmSteps = {};
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running...");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

console.log('Bot Started!')

// START
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Foydalanuvchini bazadan qidiramiz
  let user = await User.findOne({ userId });

  if (!user) {
    // Agar foydalanuvchi bazada bo‘lmasa, uni qo‘shamiz
    const userData = {
      userId,
      firstName: msg.from.first_name,
      userName: msg.from.username,
    };

    await User.create(userData);
  }

  const totalUsers = await User.find()
  // Xabarni yuboramiz (O‘zbekcha va Ruscha birga)
  const welcomeMessage = `🇺🇿 Assalomu alaykum!\n🎬 Menga kino kodini yuboring, men sizga videoni jo‘nataman.\n\n🇷🇺 Привет!\n🎬 Отправьте мне код фильма, и я пришлю вам видео.`;
  const adminMessage = `🆕 Yangi foydalanuvchi qo‘shildi!\n\n👤 Ismi: ${msg.from.first_name}\n🔹 Username: @${msg.from.username || "Mavjud emas"}\n🆔 ID: ${userId}\n📊 Jami foydalanuvchilar: ${totalUsers.length} ta`;

  bot.sendMessage(ADMIN_ID, adminMessage);
  bot.sendMessage(OWNER_ID, adminMessage)
  bot.sendMessage(chatId, welcomeMessage);
});

// UPLOAD 
bot.onText(/\/new/, (msg) => {
  if (msg.from.id === ADMIN_ID || msg.from.id === OWNER_ID) {
    filmSteps[msg.from.id] = { step: "waitingForVideo", lastMsg: null };
    bot.sendMessage(msg.chat.id, "📌 Kino faylini yuboring.").then((sentMsg) => {
      filmSteps[msg.from.id].lastMsg = sentMsg.message_id;
    });
  }
});

// Delete 
bot.onText(/\/delete/, async (msg) =>{
  const userId = msg.from.id
  const chatId = msg.chat.id
  if(userId == OWNER_ID) {
    filmSteps[userId] = { step: "waitingForDeleteCode", lastMsg: null};
    bot.sendMessage(chatId, "O'chirmoqchi bo'lgan faylingizning Kodini yuboring")
  }
})

// LIST
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Telegram Kanalimiz", url: "https://t.me/MyMediaHD" }],
      ],
    },
  };

  bot.sendMessage(chatId, "📌 Bizning rasmiy kanalimizga qo‘shiling va kino kodlari bilan tanishing!", options);
});


bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  async function deleteLastMsg(userId) {
    if (filmSteps[userId]?.lastMsg) {
      try {
        await bot.deleteMessage(chatId, filmSteps[userId].lastMsg);
      } catch (err) {}
    }
  }

  if (filmSteps[userId]?.step === "waitingForVideo" && msg.video) {
    await deleteLastMsg(userId);
    filmSteps[userId] = { step: "waitingForFileName", fileId: msg.video.file_id };

    bot.sendMessage(chatId, "📌 Kinoning nomini kiriting:").then((sentMsg) => {
      filmSteps[userId].lastMsg = sentMsg.message_id;
    });
    return;
  }

  if (filmSteps[userId]?.step === "waitingForFileName" && text) {
    await deleteLastMsg(userId);
    filmSteps[userId].fileName = text;
    filmSteps[userId].step = "waitingForFileType";

    bot.sendMessage(chatId, "📌 Kinoning turini tanlang: Kino, Multfilm, Serial").then((sentMsg) => {
      filmSteps[userId].lastMsg = sentMsg.message_id;
    });
    return;
  }

  if (filmSteps[userId]?.step === "waitingForFileType" && text) {
    await deleteLastMsg(userId);
    if (!["Kino", "Multfilm", "Serial"].includes(text)) {
      bot.sendMessage(chatId, "❌ Faqat 'Kino', 'Multfilm' yoki 'Serial' tanlashingiz mumkin.");
      return;
    }
    filmSteps[userId].fileType = text;
    filmSteps[userId].step = "waitingForCode";

    bot.sendMessage(chatId, "📌 Kino kodini kiriting (faqat raqam):").then((sentMsg) => {
      filmSteps[userId].lastMsg = sentMsg.message_id;
    });
    return;
  }

  if (filmSteps[userId]?.step === "waitingForCode" && !isNaN(text)) {
    await deleteLastMsg(userId);
    const existingFilm = await Films.findOne({ code: Number(text) });

    if (existingFilm) {
      bot.sendMessage(chatId, "❌ Bu kod allaqachon mavjud! Yangi kod kiriting.");
      return;
    }

    await Films.create({
      code: Number(text),
      fileId: filmSteps[userId].fileId,
      fileName: filmSteps[userId].fileName,
      fileType: filmSteps[userId].fileType,
    });

    const totalFilms = await Films.find();

    bot.sendMessage(
      chatId,
      `✅ Kino saqlandi!\n🎬 Nomi: ${filmSteps[userId].fileName}\n📂 Turi: ${filmSteps[userId].fileType}\n🔢 Kod: ${text}\n📁 Jami fayllar: ${totalFilms.length}`
    );

    delete filmSteps[userId];
    return;
  }

  if (filmSteps[userId]?.step === "waitingForDeleteCode" && !isNaN(text)) {
    const film = await Films.findOne({ code: Number(text) });

    if (!film) {
      bot.sendMessage(chatId, "❌ Bu kod bo‘yicha kino topilmadi!");
      return;
    }

    await Films.deleteOne({ code: Number(text) });
    bot.sendMessage(chatId, `✅ Kino (kod: ${text}) o‘chirildi!`);

    delete filmSteps[userId]; // Jarayonni tozalash
  }

  if (!isNaN(text)) {
    const film = await Films.findOne({ code: Number(text) });

    if (film) {
      bot.sendVideo(chatId, film.fileId, { 
        caption: `<a href="https://t.me/mymediauzbot"><b>🎬MyMedia</b></a> - Eng Sara Kino, Multfilm va Seriallar shu yerda!`,
        parse_mode: "HTML"
      });
        
      } else {
      bot.sendMessage(chatId, "❌ Kechirasiz, ushbu kodga mos keluvchi kino topilmadi.");
    }
  }
});