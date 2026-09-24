require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const app = express();
app.use(cors());
app.use(express.json());
/* =========================================
   SUPABASE
========================================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
/* =========================================
   PAYSTACK
========================================= */
const PAYSTACK_URL = "https://api.paystack.co";
const FRONTEND_URL =
  "https://mercyjohn43210-rgb.github.io/Airtime-App/";
function paystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json"
  };
}
/* =========================================
   PASSWORD HASHING
========================================= */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(
      password,
      salt,
      64,
      (error, derivedKey) => {
        if (error) {
          return reject(error);
        }
        resolve(
          `${salt}:${derivedKey.toString("hex")}`
        );
      }
    );
  });
}
function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    try {
      const [salt, key] = storedHash.split(":");
      if (!salt || !key) {
        return resolve(false);
      }
      crypto.scrypt(
        password,
        salt,
        64,
        (error, derivedKey) => {
          if (error) {
            return reject(error);
          }
          const storedKey =
            Buffer.from(key, "hex");
          const match =
            storedKey.length ===
              derivedKey.length &&
            crypto.timingSafeEqual(
              storedKey,
              derivedKey
            );
          resolve(match);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}
/* =========================================
   HOME
========================================= */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Johnmercy Backend is running"
  });
});
/* =========================================
   TEST SUPABASE
========================================= */
app.get("/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,created_at")
      .limit(10);
    if (error) {
      console.error(
        "Supabase error:",
        error
      );
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    res.json({
      success: true,
      users: data
    });
  } catch (error) {
    console.error(
      "Supabase connection error:",
      error
    );
    res.status(500).json({
      success: false,
      error:
        "Supabase connection failed"
    });
  }
});
/* =========================================
   SIGN UP
========================================= */
app.post("/users", async (req, res) => {
  try {
    const {
      name,
      email,
      password
    } = req.body;
    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Name, email and password are required"
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 6 characters"
      });
    }
    const cleanName =
      String(name).trim();
    const cleanEmail =
      String(email).trim().toLowerCase();
    const {
      data: existingUser,
      error: existingError
    } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();
    if (existingError) {
      console.error(
        "Existing user check error:",
        existingError
      );
      return res.status(500).json({
        success: false,
        error:
          existingError.message
      });
    }
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error:
          "An account with this email already exists."
      });
    }
    const passwordHash =
      await hashPassword(password);
    const {
      data,
      error
    } = await supabase
      .from("users")
      .insert([
        {
          name: cleanName,
          email: cleanEmail,
          password_hash: passwordHash
        }
      ])
      .select(
        "id,name,email,created_at"
      )
      .single();
    if (error) {
      console.error(
        "Create user error:",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          error.message
      });
    }
    res.json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error(
      "Signup error:",
      error
    );
    res.status(500).json({
      success: false,
      error:
        "Could not create account"
    });
  }
});
/* =========================================
   LOGIN
========================================= */
app.post("/login", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;
    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Email and password are required"
      });
    }
    const cleanEmail =
      String(email).trim().toLowerCase();
    const {
      data: user,
      error
    } = await supabase
      .from("users")
      .select(
        "id,name,email,password_hash,created_at"
      )
      .eq("email", cleanEmail)
      .maybeSingle();
    if (error) {
      console.error(
        "Login user lookup error:",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          error.message
      });
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid email or password."
      });
    }
    const valid =
      await verifyPassword(
        password,
        user.password_hash
      );
    if (!valid) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid email or password."
      });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at:
          user.created_at
      }
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );
    res.status(500).json({
      success: false,
      error:
        "Login failed"
    });
  }
});
/* =========================================
   INITIALIZE CARD PAYMENT
========================================= */
app.post(
  "/initialize-payment",
  async (req, res) => {
    try {
      const {
        email,
        amount
      } = req.body;
      if (
        !email ||
        amount === undefined
      ) {
        return res.status(400).json({
          error:
            "Email and amount are required"
        });
      }
      const numericAmount =
        Number(amount);
      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount < 100
      ) {
        return res.status(400).json({
          error:
            "Minimum payment amount is ₦100"
        });
      }
      const response =
        await axios.post(
          `${PAYSTACK_URL}/transaction/initialize`,
          {
            email,
            amount:
              Math.round(
                numericAmount * 100
              ),
            currency: "NGN",
            callback_url:
              FRONTEND_URL
          },
          {
            headers:
              paystackHeaders()
          }
        );
      res.json(
        response.data
      );
    } catch (error) {
      console.error(
        "Paystack initialization error:",
        error.response?.data ||
          error.message
      );
      res.status(500).json({
        error:
          error.response?.data
            ?.message ||
          "Payment initialization failed"
      });
    }
  }
);
/* =========================================
   VERIFY CARD PAYMENT
========================================= */
app.get(
  "/verify-payment/:reference",
  async (req, res) => {
    try {
      const {
        reference
      } = req.params;
      const response =
        await axios.get(
          `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(
            reference
          )}`,
          {
            headers:
              paystackHeaders()
          }
        );
      const payment =
        response.data;
      if (
        payment.status &&
        payment.data &&
        payment.data.status ===
          "success"
      ) {
        return res.json({
          success: true,
          message:
            "Payment verified successfully",
          reference:
            payment.data.reference,
          amount:
            payment.data.amount /
            100,
          currency:
            payment.data.currency,
          email:
            payment.data.customer
              ?.email || null
        });
      }
      res.json({
        success: false,
        message:
          "Payment has not been completed successfully."
      });
    } catch (error) {
      console.error(
        "Paystack verification error:",
        error.response?.data ||
          error.message
      );
      res.status(500).json({
        error:
          error.response?.data
            ?.message ||
          "Payment verification failed"
      });
    }
  }
);
/* =========================================
   INITIALIZE BANK TRANSFER
========================================= */
app.post(
  "/initialize-transfer",
  async (req, res) => {
    try {
      const {
        email,
        amount
      } = req.body;
      if (
        !email ||
        amount === undefined
      ) {
        return res.status(400).json({
          error:
            "Email and amount are required"
        });
      }
      const numericAmount =
        Number(amount);
      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount < 100
      ) {
        return res.status(400).json({
          error:
            "Minimum payment amount is ₦100"
        });
      }
      const expiresAt =
        new Date(
          Date.now() +
            30 * 60 * 1000
        ).toISOString();
      const response =
        await axios.post(
          `${PAYSTACK_URL}/charge`,
          {
            email,
            amount:
              Math.round(
                numericAmount * 100
              ),
            currency: "NGN",
            bank_transfer: {
              account_expires_at:
                expiresAt
            }
          },
          {
            headers:
              paystackHeaders()
          }
        );
      const data =
        response.data;
      if (
        data.status &&
        data.data
      ) {
        return res.json({
          status: true,
          message:
            data.message ||
            "Transfer account created",
          data: {
            reference:
              data.data.reference ||
              null,
            status:
              data.data.status ||
              null,
            amount:
              data.data.amount
                ? data.data.amount /
                  100
                : numericAmount,
            currency:
              data.data.currency ||
              "NGN",
            display_text:
              data.data.display_text ||
              null,
            account_number:
              data.data.bank_transfer
                ?.account_number ||
              null,
            bank_name:
              data.data.bank_transfer
                ?.bank_name ||
              null,
            account_name:
              data.data.bank_transfer
                ?.account_name ||
              null,
            expires_at:
              data.data.bank_transfer
                ?.account_expires_at ||
              expiresAt
          }
        });
      }
      res.status(400).json({
        status: false,
        error:
          data.message ||
          "Transfer payment could not be initialized"
      });
    } catch (error) {
      console.error(
        "Paystack transfer initialization error:",
        error.response?.data ||
          error.message
      );
      res.status(
        error.response?.status ||
          500
      ).json({
        status: false,
        error:
          error.response?.data
            ?.message ||
          "Transfer payment initialization failed"
      });
    }
  }
);
/* =========================================
   VERIFY BANK TRANSFER
========================================= */
app.get(
  "/verify-transfer/:reference",
  async (req, res) => {
    try {
      const {
        reference
      } = req.params;
      const response =
        await axios.get(
          `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(
            reference
          )}`,
          {
            headers:
              paystackHeaders()
          }
        );
      const payment =
        response.data;
      if (
        payment.status &&
        payment.data
      ) {
        const transaction =
          payment.data;
        if (
          transaction.status ===
          "success"
        ) {
          return res.json({
            success: true,
            message:
              "Transfer payment verified successfully",
            reference:
              transaction.reference,
            amount:
              transaction.amount /
              100,
            currency:
              transaction.currency,
            email:
              transaction.customer
                ?.email || null
          });
        }
        return res.json({
          success: false,
          status:
            transaction.status,
          message:
            "Transfer has not been completed yet."
        });
      }
      res.json({
        success: false,
        message:
          "Transfer could not be verified."
      });
    } catch (error) {
      console.error(
        "Transfer verification error:",
        error.response?.data ||
          error.message
      );
      res.status(500).json({
        error:
          error.response?.data
            ?.message ||
          "Transfer verification failed"
      });
    }
  }
);
/* =========================================
   PAYSTACK WEBHOOK
========================================= */
app.post(
  "/paystack-webhook",
  (req, res) => {
    try {
      const event =
        req.body;
      console.log(
        "Paystack webhook received:",
        event.event
      );
      if (
        event.event ===
        "charge.success"
      ) {
        console.log(
          "Successful Paystack transaction:",
          event.data?.reference
        );
      }
      res.sendStatus(200);
    } catch (error) {
      console.error(
        "Webhook error:",
        error.message
      );
      res.sendStatus(200);
    }
  }
);
/* =========================================
   SERVER
========================================= */
const PORT =
  process.env.PORT || 3000;
app.listen(
  PORT,
  () => {
    console.log(
      `Johnmercy Backend running on port ${PORT}`
    );
  }
);
