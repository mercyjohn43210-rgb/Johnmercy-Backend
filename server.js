const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* HOME */
app.get("/", (req, res) => {
  res.send("Johnmercy Backend is running");
});

/* INITIALIZE PAYMENT */
app.post("/initialize-payment", async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || !amount) {
      return res.status(400).json({
        error: "Email and amount are required"
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      return res.status(400).json({
        error: "Minimum payment amount is ₦100"
      });
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email,
        amount: Math.round(numericAmount * 100),
        currency: "NGN",
        callback_url:
          "https://mercyjohn43210-rgb.github.io/Airtime-App/"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Payment initialization failed"
    });
  }
});

/* VERIFY PAYMENT */
app.get("/verify-payment/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        error: "Payment reference is required"
      });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const payment = response.data;

    if (
      payment.status &&
      payment.data &&
      payment.data.status === "success"
    ) {
      return res.json({
        success: true,
        message: "Payment verified successfully",
        reference: payment.data.reference,
        amount: payment.data.amount / 100,
        currency: payment.data.currency,
        email: payment.data.customer?.email || null
      });
    }

    return res.json({
      success: false,
      message: "Payment has not been completed successfully."
    });

  } catch (error) {
    console.error(
      "Paystack verification error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Payment verification failed"
    });
  }
});

/* SERVER */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Johnmercy Backend running on port ${PORT}`
  );
});
