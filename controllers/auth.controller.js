import User from "../models/user.model.js";
import bcrypt from "bcrypt"
import generateTokenandSetCookie from "../utils/generateTokenandSetCookie.js";

export const loginUser = async (req, res) => {
    try {
        const { userName, password } = req.body;
        const user = await User.findOne({ userName });
        const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

        if(!user || !isPasswordCorrect){
            return res.status(400).json({
                error: "Invalid username or password"
            })
        }

        generateTokenandSetCookie(user._id, res);

        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            userName: user.userName,
            profilePicture: user.profilePicture
        })
    } catch (error) {
        console.log(`Error in login controller: ${error.message}`);
        res.status(500).json({
            error: "Internal server error"
        })
    }
}
export const signup = async (req, res) => {
    try {
        const { fullName, userName, password, confirmPassword, gender } = req.body;

        if (password !== confirmPassword) {
            return res.satus(40).json({ error: "Passwords don't match" });
        }

        const user = await User.findOne({ userName });

        if (user) {
            return res.status(400).json({ error: "Username already exists" });
        }

        // hash password here
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const boyProfilePic = `https://avatar.iran.liara.run/public/boy?username=${userName}`
        const girlProfilePic = `https://avatar.iran.liara.run/public/girl?username=${userName}`

        const newUser = new User({
            fullName,
            userName,
            password: hashedPassword,
            gender,
            profilePicture: gender === "male" ? boyProfilePic : girlProfilePic
        })
        if (newUser) {
            generateTokenandSetCookie(newUser._id, res);
            await newUser.save();

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                userName: newUser.userName,
                profilePicture: newUser.profilePicture
            })
        } else {
            res.status(400).json({
                error: "Invalid user data"
            })
        }

    } catch (error) {
        console.log(`Error in signup controller: ${error.message}`);
        res.status(500).json({
            error: "Internal server error"
        })

    }
}
export const logout = (req, res) => {
    try {
        res.cookie("token", "", {maxAge:0})
        res.status(200).json({message:"Logout successfully"})
    } catch (error) {
        console.log(`Error in logout controller: ${error.message}`);
        res.status(500).json({
            error: "Internal server error"
        })
    }
}