// chatbot.js
function getBotResponse(message) {
    message = (message || "").toLowerCase();

    // Greetings
    if (message.includes("hello") || message.includes("hi") || message.includes("hey")) {
        return "Hello! 👋 I’m your academic assistant. Do you want help with Login, Courses, Certificates, or Equivalency?";
    }

    // Login / signup help
    if (message.includes("login")) {
        return "🔑 To login: Enter your email & password on the login page. If you don’t have an account, type 'signup'.";
    }
    if (message.includes("signup") || message.includes("register")) {
        return "📝 Signup: Create a new account by entering your email, password, and selecting your role (Student / Admin). Each Admin can create ONE University.";
    }

    // Courses
    if (message.includes("course") || message.includes("enroll")) {
        return "📚 You can browse courses across multiple universities in the Student Dashboard → Courses section. After enrolling, your credits will be added when you complete.";
    }

    // Credits
    if (message.includes("credit") || message.includes("credits")) {
        return "💳 Your earned credits are visible in the Student Dashboard → Credits section. Credits from multiple universities are combined here for equivalency.";
    }

    // Certificates
    if (message.includes("certificate") || message.includes("certificates")) {
        return "🎓 Certificates: Students upload certificates after course completion. Admins review & approve them. Employers can validate them later.";
    }

    // Equivalency
    if (message.includes("equivalency") || message.includes("equivalent")) {
        return "⚖️ Equivalency: This feature checks if your combined credits from different universities match the requirements for a specific degree. You can request it from the dashboard.";
    }

    // Employer validation
    if (message.includes("employer") || message.includes("validate")) {
        return "🏢 Employers can validate certificates by entering the Certificate ID in the Employer Portal. This ensures authenticity.";
    }

    // Step-by-step guided help
    if (message.includes("help") || message.includes("support") || message.includes("guide")) {
        return "Here’s a quick guide:\n\n" +
            "1️⃣ Login or Signup first.\n" +
            "2️⃣ As a Student → Enroll in courses across universities.\n" +
            "3️⃣ Complete courses → Earn credits.\n" +
            "4️⃣ Upload certificates for verification.\n" +
            "5️⃣ Request Equivalency to combine credits from multiple universities.\n" +
            "6️⃣ Employers can validate certificates through the portal.\n\n" +
            "👉 What would you like to know more about?";
    }

    // Default
    return "🤔 I didn’t get that. Try asking about: Login, Signup, Courses, Credits, Certificates, Equivalency, or Employer validation.";
}

module.exports = getBotResponse;
