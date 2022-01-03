const express = require("express");
const cors = require("cors");
const { MongoClient, CURSOR_FLAGS } = require("mongodb");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET);

cloudinary.config({
    cloud_name: "dpdk6agx8",
    api_key: "275637321624967",
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const port = process.env.PORT || 8888;
const app = express();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y6hb5.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(fileUpload());

async function run() {
    try {
        await client.connect();
        const database = client.db("antsNest");
        const userCollection = database.collection("users");
        const listingCollection = database.collection("listing");
        const bookingCollection = database.collection("booking");
        console.log("Database connected");

        // post user
        app.post("/user", async (req, res) => {
            const { fullName, email, imageURL } = req.body;
            const user = {
                fullName,
                email,
                imageURL,
            };
            const result = await userCollection.insertOne(user);
            res.json(result);
        });

        // put user
        app.put("/user", async (req, res) => {
            const data = req.body;
            const filter = { email: data.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: data,
            };
            const result = await userCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            res.json(result);
        });

        // get my listing
        app.get("/my-listing/:email", async (req, res) => {
            const email = req.params.email;
            const query = { "landlord.email": email };
            const cursor = listingCollection.find(query);
            const result = await cursor.toArray();
            res.json(result);
        });

        // upload cloudinary
        app.post("/add-listing", async (req, res) => {
            try {
                const { houseData, images } = req.body;
                let image = {};
                let promises = [];
                images.forEach(async (image) => {
                    promises.push(
                        cloudinary.uploader.upload(image, {
                            folder: "ants_nest_listing",
                        })
                    );
                });
                const response = await Promise.all(promises);
                const listingImages = response.map((image) => image.secure_url);
                listingImages.forEach((i, index) => {
                    let obj = "img" + (index + 1);
                    image[obj] = i;
                });
                houseData.image = image;
                const result = await listingCollection.insertOne(houseData);
                res.json(result);
            } catch (err) {
                console.log(err);
            }
        });

        // get all listing
        app.get("/add-listing", async (req, res) => {
            const cursor = listingCollection.find({});
            const result = await cursor.toArray();
            res.json(result);
        });

        // post booking
        app.post("/booking", async (req, res) => {
            const { email, house, searchHouse } = req.body;
            const {
                image,
                houseTitle,
                address,
                city,
                price,
                cleaningFee,
                serviceFee,
                landlord,
            } = house;
            const prices =
                parseInt(price) + parseInt(cleaningFee) + parseInt(serviceFee);
            const { arrivalDate, departureDate, adult, child, babies } =
                searchHouse;
            const bookingHouse = {
                email,
                img1: image.img1,
                houseTitle,
                address,
                city,
                prices,
                name: landlord.name,
                phone: landlord.phone,
                arrivalDate,
                departureDate,
                adult,
                child,
                babies,
            };
            const result = await bookingCollection.insertOne(bookingHouse);
            res.json(result);
        });

        // payment
        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.totalPrice * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "eur",
                automatic_payment_methods: {
                    enabled: true,
                },
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
    } finally {
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Ant's Nest");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
