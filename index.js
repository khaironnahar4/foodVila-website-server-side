const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.port || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require('stripe')(process.env.PAYMENT_SECRETE_KEY)

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzvqarc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");

    const database = client.db("foodVila");
    const userCollection = database.collection("users");
    const menuCollection = database.collection("menu");
    const reviewCollection = database.collection("reviews");
    const cardCollection = database.collection("cards");
    const paymentCollection = database.collection("payments");

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        user,
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      // console.log(token);
      
      res.send({token});
    });

    // verify token middleware
    const verifyToken = (req, res, next) =>{
      if(!req.headers.authorization){
        return res.status(401).send({message: "Unauthorized user!"});
      }
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: "Unauthorized User"});
        }
        req.decoded = decoded;
        next();
      })
    }

    // verify admin middleware 
    const verifyAdmin = async (req, res, next) =>{
      const email = req.decoded.email;
      const query = {email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role == 'admin';
      if(!isAdmin){
        return res.status(403).send({message: "Forbidden user!"});
      }
      next();
    }
    

    // api for check if user is admin
    app.get('/users/admin/:email', verifyToken, async (req, res)=>{
      const email = req.params.email;
      if(email !== req.decoded.email ){
        return res.status(403).send({message: "Forbidden user!"});
      }
      const query = {email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role == 'admin';
      }
      res.send({admin});
    })

    // payment method
    app.post("/create-checkout-session", async(req, res)=>{
      const {price} = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent  = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      })

    })

    // payment
    app.get("/payment", verifyToken, async (req, res)=>{
      const query = {email : req.query.email};

      // console.log(req.decoded);
      
      if(req.query.email !== req.decoded.email){
        return res.status(403).send({message: "forbiden access."});
      }

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payment', async (req, res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // console.log(payment);
      

      // delete each items from the cart
      const query = {_id : {
        $in: payment.cartIds.map(id => new ObjectId(id))
      }};
      const deleteResult = await cardCollection.deleteMany(query);

      res.send({paymentResult, deleteResult});
    })

    // user collection
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user.email;
      const query = { email };
      const cursor = await userCollection.findOne(query);
      if (cursor) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedUser);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // card collection
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await cardCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const card = req.body;
      const result = await cardCollection.insertOne(card);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cardCollection.deleteOne(query);
      res.send(result);
    });

    // menu collection
    app.get("/menu", async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category) {
        query = { category };
      }
      
      const result = await menuCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/menu/:id', async (req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await menuCollection.findOne(query);
      res.send(result);
    })

    app.post('/menu',  async (req, res)=>{
      const data = req.body;
      const result = await menuCollection.insertOne(data);
      res.send(result);
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res)=>{
      const id = req.params.id;
      const menu = req.body;
      const filter = {_id: new ObjectId(id)};
      const updatedMenu = {
        $set:{
          name: menu.name,
          recipe: menu.recipe,
          image: menu.image,
          category: menu.category,
          price: menu.price,
        }
      }

      const result = await menuCollection.updateOne(filter, updatedMenu);
      res.send(result);
    })

    // review collection
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`app is running on port: ${port}`);
});
