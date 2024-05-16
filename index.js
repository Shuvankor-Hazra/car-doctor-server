const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// Middleware

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cars-doctor-bfc9b.web.app",
      "https://cars-doctor-bfc9b.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fi65pdm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middlewares
const logger = async (req, res, next) => {
  console.log("called:", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log("value of token in middleware", token);
  // no token available
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    // if token is valid then it would be decoded
    console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

const cookieOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    // Auth related API
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.cookie("token", token, cookieOption).send({ success: true });
    });

    app.post("/logOut", (req, res) => {
      const user = req.body;
      console.log("login out", user);
      res
        .clearCookie("token", { ...cookieOption, maxAge: 0 })
        .send({ success: true });
    });

    // Services related API
    app.get("/services", async (req, res) => {
      const filter = req.query;
      console.log(filter);
      const query = {
        // price: { $lt: 100 },
        title: { $regex: filter.search, $options: "i" },
      };
      const options = {
        sort: {
          price: filter.sort === "asc" ? 1 : -1,
        },
      };
      const cursor = serviceCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });
    // ----------------------------

    // Services related API
    // app.get("/services", logger, async (req, res) => {
    //   const filter = req.query;
    //   console.log(filter);
    //   const query = {
    //     // price: { $lt: 100 },
    //   };
    //   // Retrieve data from the database and convert price to number
    //   const cursor = serviceCollection.find(query).map((service) => ({
    //     ...service,
    //     price: parseFloat(service.price),
    //   }));
    //   // Custom sorting function for numeric values
    //   const numericSort = (a, b) => a.price - b.price;
    //   let result = await cursor.toArray();
    //   // Sort the data based on the numeric price values
    //   if (filter.sort === "asc") {
    //     result = result.sort(numericSort);
    //   } else if (filter.sort === "desc") {
    //     result = result.sort((a, b) => numericSort(b, a)); // Reverse sorting for descending
    //   }
    //   res.send(result);
    // });

    // ----------------------------
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1, email: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // Bookings related API
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log("tok tok token", req.cookies.token);
      console.log("User in the valid token", req.user);
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      const updateDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctor is running.....");
});

app.listen(port, () => {
  console.log(`Car doctor is running on port: ${port}`);
});
