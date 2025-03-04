import {Schema, model} from "mongoose"

const UserSchema = new Schema({
    userId: {type: Number, required: true, unique: true},
    firstName: {type: String, required: true},
    userName: {type: String},
}, {timestamps: true})


const User = model('User', UserSchema)
export default User;