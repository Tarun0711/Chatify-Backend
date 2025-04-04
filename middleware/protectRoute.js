import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const protectRoute = async (req, res, next) => {
	try {
		let token;
		
		// Check Authorization header first
		const authHeader = req.headers.authorization;
		console.log("Authorization header:", authHeader);
		
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.split(' ')[1];
			console.log("Token from Authorization header:", token);
		} 
		// If no token in header, check cookie
		else {
			token = req.cookies["chat-user"];
			console.log("Token from cookie:", token);
		}

		if (!token) {
			console.log("No token found in either header or cookie");
			return res.status(401).json({ error: "Unauthorized - No Token Provided" });
		}

		console.log("Attempting to verify token with secret:", process.env.JWT_SECRET);
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		console.log("Decoded token:", decoded);

		if (!decoded) {
			return res.status(401).json({ error: "Unauthorized - Invalid Token" });
		}

		const user = await User.findById(decoded.userId).select("-password");

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		req.user = user;
		next();
	} catch (error) {
		console.log("Error in protectRoute middleware: ", error.message);
		console.log("Error details:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export default protectRoute;