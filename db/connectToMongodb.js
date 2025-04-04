import mongoose from "mongoose";

const connectToMongodb = async ()=>{
    try{
        await mongoose.connect(process.env.MONGO_DB_URI);
        console.log("Connected to db"); 
    } catch(error){
        console.error(`Error while connecting to database ${error}`);
    } 
}
 
export default connectToMongodb;  