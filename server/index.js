const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require("socket.io");

const authRoutes = require('./Routes/AuthRoutes');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: true,
});
app.use(express.json());
const usersSchema=new mongoose.Schema({
  name: String,
  gender: String,
  address: String,
  age: Number,
  phone: Number,
})
const appointment = mongoose.model('appointment',usersSchema);
app.post('/appoint', (req, res) => {
  console.log('Received appointment data:', req.body);
  appointment.create(req.body)
    .then((savedAppointment) => {
      console.log('Appointment saved:', savedAppointment);
      res.status(201).json({ status: 'success', data: savedAppointment });
    })
    .catch((error) => {
      console.error('Error saving appointment:', error);
      res.status(500).json({ status: 'error', message: 'Failed to save appointment.' });
    });
});




const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

app.use(cors({
  origin: ["http://localhost:3000"],
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

mongoose.connect('mongodb://127.0.0.1:27017/jwt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection successful'))
.catch((err) => console.log(err));

app.use("/", authRoutes);

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);
  socket.on("room:join", (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    io.to(room).emit("user:joined", { email, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
