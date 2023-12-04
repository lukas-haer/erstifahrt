const mongoose = require('mongoose')

const teamerSchema = new mongoose.Schema({
    name: String,
    password: String,
    role: {
        type:String,
        default: "Standard",
    },
  
})

module.exports = mongoose.model("Teamer", teamerSchema)
