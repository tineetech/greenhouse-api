import express from "express"
import cors from "cors"
import midtransClient from "midtrans-client"
import dotenv from "dotenv";
dotenv.config(); 

// const express = require('express');
// const cors = require('cors');
// const midtransClient = require('midtrans-client');

const app = express();
const port = 3000;
app.use(cors()); // Mengizinkan semua asal
app.use(express.json()); // Parsing JSON body

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

app.get('/', (req, res) => {
    res.status(200).json({
        message: "server running..",
        // serverKey: "token" + process.env.MIDTRANS_SERVER_KEY,
        isProd: "false"
    })
})

app.post('/', (req, res) => {
    res.status(200).json({
        status: "success"
    })
})

app.post('/api/create-transaction', async (req, res) => {
  try {
    const { idOrder, productId, productName, price, totals, qty, userId, userName } = req.body;

    const parameter = {
      transaction_details: {
        order_id: idOrder,
        gross_amount: parseInt(totals),
      },
      item_details: [
        {
          id: productId,
          price: parseInt(price),
          quantity: parseInt(qty),
          name: productName,
        },
      ],
      customer_details: {
        first_name: userName,
        email: `${userId}@example.com`, // Ganti dengan email aktual
      },
    };

    const transaction = await snap.createTransaction(parameter);
    res.status(200).json({ token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.listen(port, () => {
  console.log('Server running on http://localhost:' + port);
});
