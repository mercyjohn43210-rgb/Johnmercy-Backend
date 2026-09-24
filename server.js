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
            storedKey.length === derivedKey.length &&
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
      error: "Supabase connection failed"
    });
  }
});

/* =========================================
   GET WALLET
========================================= */

app.get("/wallet/:email", async (req, res) => {
  try {
    const email = String(req.params.email)
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required"
      });
    }

    const { data, error } = await supabase
      .from("wallets")
      .select(
        "id,email,balance,created_at,updated_at"
      )
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error(
        "Wallet lookup error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Wallet not found"
      });
    }

    res.json({
      success: true,
      wallet: data
    });
  } catch (error) {
    console.error(
      "Wallet error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Could not get wallet"
    });
  }
});

/* =========================================
   CREATE WALLET
========================================= */

app.post("/wallet/create", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required"
      });
    }

    const {
      data: existingWallet,
      error: findError
    } = await supabase
      .from("wallets")
      .select(
        "id,email,balance,created_at,updated_at"
      )
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      console.error(
        "Wallet search error:",
        findError
      );

      return res.status(500).json({
        success: false,
        error: findError.message
      });
    }

    if (existingWallet) {
      return res.json({
        success: true,
        wallet: existingWallet
      });
    }

    const {
      data,
      error
    } = await supabase
      .from("wallets")
      .insert([
        {
          email,
          balance: 0
        }
      ])
      .select(
        "id,email,balance,created_at,updated_at"
      )
      .single();

    if (error) {
      console.error(
        "Wallet creation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      wallet: data
    });
  } catch (error) {
    console.error(
      "Create wallet error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Could not create wallet"
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

    if (!name || !email || !password) {
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
      String(email)
        .trim()
        .toLowerCase();

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
        error: existingError.message
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
        error: error.message
      });
    }

    /* CREATE USER WALLET */

    const {
      data: wallet,
      error: walletError
    } = await supabase
      .from("wallets")
      .insert([
        {
          email: cleanEmail,
          balance: 0
        }
      ])
      .select(
        "id,email,balance,created_at,updated_at"
      )
      .single();

    if (walletError) {
      console.error(
        "Wallet creation error after signup:",
        walletError
      );
    }

    res.json({
      success: true,
      user: data,
      wallet: wallet || null
    });
  } catch (error) {
    console.error(
      "Signup error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Could not create account"
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

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error:
          "Email and password are required"
      });
    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

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
        error: error.message
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

    /* GET USER WALLET */

    let {
      data: wallet,
      error: walletError
    } = await supabase
      .from("wallets")
      .select(
        "id,email,balance,created_at,updated_at"
      )
      .eq("email", cleanEmail)
      .maybeSingle();

    if (walletError) {
      console.error(
        "Wallet lookup during login:",
        walletError
      );
    }

    /* CREATE WALLET IF IT DOES NOT EXIST */

    if (!wallet) {
      const result =
        await supabase
          .from("wallets")
          .insert([
            {
              email: cleanEmail,
              balance: 0
            }
          ])
          .select(
            "id,email,balance,created_at,updated_at"
          )
          .single();

      wallet = result.data;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at
      },
      wallet: wallet || null
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Login failed"
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
        !Number.isFinite(numericAmount) ||
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

      res.json(response.data);
    } catch (error) {
      console.error(
        "Paystack initialization error:",
        error.response?.data ||
          error.message
      );

      res.status(500).json({
        error:
          error.response?.data?.message ||
          "Payment initialization failed"
      });
    }
  }
);

/* =========================================
   VERIFY CARD PAYMENT
   AND CREDIT WALLET
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
        const transaction =
          payment.data;

        const paymentReference =
          transaction.reference;

        const email =
          transaction.customer?.email
            ?.trim()
            .toLowerCase();

        const amount =
          Number(transaction.amount) /
          100;

        if (
          !email ||
          !paymentReference ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid payment information"
          });
        }

        /* CHECK DUPLICATE PAYMENT */

        const {
          data: existingTransaction,
          error:
            transactionCheckError
        } = await supabase
          .from("wallet_transactions")
          .select("id,reference")
          .eq(
            "reference",
            paymentReference
          )
          .maybeSingle();

        if (transactionCheckError) {
          console.error(
            "Transaction check error:",
            transactionCheckError
          );

          return res.status(500).json({
            success: false,
            error:
              transactionCheckError.message
          });
        }

        if (existingTransaction) {
          return res.json({
            success: true,
            alreadyCredited: true,
            message:
              "This payment has already been credited.",
            reference:
              paymentReference
          });
        }

        /* GET WALLET */

        const {
          data: wallet,
          error: walletError
        } = await supabase
          .from("wallets")
          .select(
            "id,email,balance"
          )
          .eq(
            "email",
            email
          )
          .maybeSingle();

        if (walletError) {
          console.error(
            "Wallet lookup error:",
            walletError
          );

          return res.status(500).json({
            success: false,
            error:
              walletError.message
          });
        }

        if (!wallet) {
          return res.status(404).json({
            success: false,
            error:
              "Wallet not found"
          });
        }

        /* ADD MONEY */

        const currentBalance =
          Number(wallet.balance) ||
          0;

        const newBalance =
          currentBalance +
          amount;

        const {
          data: updatedWallet,
          error: updateError
        } = await supabase
          .from("wallets")
          .update({
            balance:
              newBalance,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            wallet.id
          )
          .select(
            "id,email,balance,created_at,updated_at"
          )
          .single();

        if (updateError) {
          console.error(
            "Wallet update error:",
            updateError
          );

          return res.status(500).json({
            success: false,
            error:
              updateError.message
          });
        }

        /* SAVE TRANSACTION */

        const {
          error:
            transactionError
        } = await supabase
          .from("wallet_transactions")
          .insert([
            {
              reference:
                paymentReference,
              email,
              type: "credit",
              amount
            }
          ]);

        if (transactionError) {
          console.error(
            "Transaction save error:",
            transactionError
          );

          /*
             The wallet has already been credited.
             The unique reference prevents
             another successful credit later.
          */
        }

        return res.json({
          success: true,
          message:
            "Payment verified and wallet credited.",
          reference:
            paymentReference,
          amount,
          currency:
            transaction.currency,
          email,
          wallet:
            updatedWallet
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
          error.response?.data?.message ||
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
        !Number.isFinite(numericAmount) ||
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
          error.response?.data?.message ||
          "Transfer payment initialization failed"
      });
    }
  }
);

/* =========================================
   VERIFY BANK TRANSFER
   AND CREDIT WALLET
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
          const paymentReference =
            transaction.reference;

          const email =
            transaction.customer?.email
              ?.trim()
              .toLowerCase();

          const amount =
            Number(transaction.amount) /
            100;

          if (
            !email ||
            !paymentReference ||
            !Number.isFinite(amount) ||
            amount <= 0
          ) {
            return res.status(400).json({
              success: false,
              error:
                "Invalid transfer information"
            });
          }

          /* CHECK DUPLICATE */

          const {
            data: existingTransaction,
            error:
              transactionCheckError
          } = await supabase
            .from("wallet_transactions")
            .select("id,reference")
            .eq(
              "reference",
              paymentReference
            )
            .maybeSingle();

          if (transactionCheckError) {
            console.error(
              "Transfer transaction check error:",
              transactionCheckError
            );

            return res.status(500).json({
              success: false,
              error:
                transactionCheckError.message
            });
          }

          if (existingTransaction) {
            return res.json({
              success: true,
              alreadyCredited: true,
              message:
                "This transfer has already been credited.",
              reference:
                paymentReference
            });
          }

          /* GET WALLET */

          const {
            data: wallet,
            error: walletError
          } = await supabase
            .from("wallets")
            .select(
              "id,email,balance"
            )
            .eq(
              "email",
              email
            )
            .maybeSingle();

          if (walletError) {
            console.error(
              "Transfer wallet lookup error:",
              walletError
            );

            return res.status(500).json({
              success: false,
              error:
                walletError.message
            });
          }

          if (!wallet) {
            return res.status(404).json({
              success: false,
              error:
                "Wallet not found"
            });
          }

          /* ADD MONEY */

          const currentBalance =
            Number(wallet.balance) ||
            0;

          const newBalance =
            currentBalance +
            amount;

          const {
            data: updatedWallet,
            error: updateError
          } = await supabase
            .from("wallets")
            .update({
              balance:
                newBalance,
              updated_at:
                new Date().toISOString()
            })
            .eq(
              "id",
              wallet.id
            )
            .select(
              "id,email,balance,created_at,updated_at"
            )
            .single();

          if (updateError) {
            console.error(
              "Transfer wallet update error:",
              updateError
            );

            return res.status(500).json({
              success: false,
              error:
                updateError.message
            });
          }

          /* SAVE TRANSACTION */

          const {
            error:
              transactionError
          } = await supabase
            .from("wallet_transactions")
            .insert([
              {
                reference:
                  paymentReference,
                email,
                type: "credit",
                amount
              }
            ]);

          if (transactionError) {
            console.error(
              "Transfer transaction save error:",
              transactionError
            );
          }

          return res.json({
            success: true,
            message:
              "Transfer verified and wallet credited.",
            reference:
              paymentReference,
            amount,
            currency:
              transaction.currency,
            email,
            wallet:
              updatedWallet
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
          error.response?.data?.message ||
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
