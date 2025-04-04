import jwt from "jsonwebtoken";

const generateTokenAndSetCookie = (userId, res) => {
	const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: "15d",
	});
	res.cookie("chat-user", token, {
		maxAge: 15 * 24 * 60 * 60 * 1000, // MS
		httpOnly: true, // prevent XSS attacks cross-site scripting attacks
		sameSite: "lax", // Changed from strict to lax for CORS
		secure: process.env.NODE_ENV !== "development",
	});
	return token;
};

export default generateTokenAndSetCookie;