import express from "express"
import cors from "cors"
import midtransClient from "midtrans-client"
import dotenv from "dotenv";
// import admin from "firebase-admin"

dotenv.config(); 

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

app.get('/api/get-transaction/:id', async (req, res) => {
  try {
    const id = req.params.id
    const serverKey = process.env.MIDTRANS_SERVER_KEY; 
    const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

    const response = await fetch(`https://api.sandbox.midtrans.com/v2/${id}/status`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": authHeader
      }
    })
    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data); // Kirim data ke klien
    } else {
      const errorData = await response.json();
      res.status(response.status).json(errorData); // Kirim error dari API Midtrans
    }
  } catch (error) {
    res.send(400).json({mess: "not found"})
  }
})

app.post('/api/create-transaction', async (req, res) => {
  try {
    const { idOrder, productId, productName, price, qty, userId, userName, discPrice } = req.body;

    const parsedPrice = parseInt(price);
    const parsedQty = parseInt(qty);
    const parsedDiscPrice = discPrice ? parseInt(discPrice) : 0;

    // Hitung total harga item
    const itemTotal = parsedPrice * parsedQty;

    // Hitung pajak dan biaya layanan
    const taxAmount = itemTotal * (11 / 100); // 11% pajak
    const serviceCharge = itemTotal * (2 / 100); // 2% biaya layanan

    // Hitung gross amount
    var grossAmount = itemTotal + taxAmount + serviceCharge;

    if (parsedDiscPrice > 0) {
      if (parsedDiscPrice > grossAmount) {
        throw new Error("Discount price cannot be greater than the total amount.");
      }
      grossAmount -= parsedDiscPrice;
    }

    const parameter = {
      transaction_details: {
        order_id: idOrder,
        gross_amount: grossAmount, // Harus sama dengan total item_details
      },
      item_details: [
        {
          id: productId,
          price: parsedPrice,
          quantity: parsedQty,
          name: productName,
        },
        {
          id: 'tax',
          price: Math.round(taxAmount), // Pajak
          quantity: 1,
          name: 'Tax (11%)',
        },
        {
          id: 'service_charge',
          price: Math.round(serviceCharge), // Biaya layanan
          quantity: 1,
          name: 'Service Charge (2%)',
        },
        ...(parsedDiscPrice > 0
          ? [
              {
                id: 'discount',
                price: -Math.round(parsedDiscPrice), // Diskon harus bernilai negatif
                quantity: 1,
                name: 'Discount',
              },
            ]
          : []),
      ],
      customer_details: {
        first_name: userName,
        email: `${userName}@example.com`, // Ganti dengan email aktual
      },
    };

    const transaction = await snap.createTransaction(parameter);
    res.status(200).json({ token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction', details: error.message });
  }
});


app.get('/api/confirm-payment', async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ mess: 'order_id is required' });
    }
    const transactionStatus = await snap.transaction.status(order_id);

    if (transactionStatus && transactionStatus.transaction_status === "settlement") {
      const resFb = await fetch('https://greenhousez-default-rtdb.firebaseio.com/orders.json');
      
      if (resFb.ok) {
        const firebaseData = await resFb.json(); // Data dari Firebase, biasanya berupa objek
    
        // Konversi data Firebase menjadi array untuk menggunakan metode `find`
        const firebaseArray = Object.values(firebaseData || {}).map((item, index) => ({
          ...item,
          _key: Object.keys(firebaseData || [])[index], // Tambahkan kunci untuk referensi jika diperlukan
        }));
    
        // Cari data berdasarkan `order_id`
        const find = firebaseArray.find((item) => item.id_order === order_id);
    
        if (find && find.status !== "success") {
          const update = await fetch("https://greenhousez-default-rtdb.firebaseio.com/orders/" + find._key + ".json", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "shipping" })
          })

          if (update.ok) {
            return res.redirect('https://greenhousez.web.app/payment/' + order_id);
          }
          return res.status(200).json({
            message: 'Data got it',
            data: find,
          });
        } else {
           res.status(404).json({
            message: 'Data found, but status is already success',
          });
        }
      } else {
        return res.status(500).json({
          message: 'Failed to fetch data from Firebase',
          error: await resFb.text(),
        });
      }
    } else {
      res.status(500).json({ mess: "data order not found in midtrans." })
    }
    
    } catch (error) {
    res.status(500).json({ mess: "error failed to fetch midtrans or data not found" })
  }
})

app.listen(port, () => {
  console.log('Server running on http://localhost:' + port);
});
