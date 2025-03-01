import { Schema, model } from "mongoose";

const FilmSchema = new Schema({
    code: Number,
    fileId: String,
    fileName: String,
    fileType: String,
}, {timestamps: true})

const Films = model("Films", FilmSchema)
export default Films;