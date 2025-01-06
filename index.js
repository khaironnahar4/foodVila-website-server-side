const express = require('express');
const cors = require('cors');
const port = process.env.port || 5000;
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

app.use(cors());
app.use(express.json());

app.get('/', (req, res)=>{
    res.send("server is running");
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzvqarc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");

    const database = client.db('foodVila');
    const menuCollection = database.collection('menu');
    const reviewCollection = database.collection('reviews');

    app.get('/menu', async (req, res)=>{
        const category = req.query.category;
        let query = {};
        if(category){
            query = {category}
        }
        const result = await menuCollection.find(query).toArray();
        res.send(result);
    })

    app.get('/reviews', async (req, res)=>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, ()=> {
    console.log(`app is running on port: ${port}`)
})
