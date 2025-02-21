// Current issue:
/**
 *  Ntwk intefaces are rendered proprely, [object Object] , works fine on server console
 * testing of capturing is remaining. 
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pcap = require('pcap');
// const NetworkInterface = require('pcap/lib/network_interface');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let captureSession = null;
let isCapturing = false;

// Hardcoded interface name
const DEFAULT_INTERFACE = 'en0';


/*
const getInterfaces = () => {
    try {
        const interfaces = NetworkInterface.findalldevs()
            .filter(dev => dev.addresses.length > 0)
            .map(dev => ({
                name: dev.name,
                description: dev.addresses
                    .map(addr => addr.addr)
                    .join(', ')
            }));
        
        console.log('Raw interfaces:', interfaces);
        return interfaces;
    } catch (error) {
        console.error('Failed to get interfaces:', error);
        return [];
    }
};
*/

// Modify startCapture to use default interface
const startCapture = () => {
    try {
        captureSession = pcap.createSession(DEFAULT_INTERFACE, '');
        isCapturing = true;

        captureSession.on('packet', (rawPacket) => {
            const packet = parsePacket(rawPacket);
            io.emit('packet', packet);
        });
    } catch (error) {
        console.error('Failed to start capture:', error);
        io.emit('capture-error', error.message);
    }
};

// func to stop the capture 
const stopCapture = () => {
    if (captureSession) {
        captureSession.close();
        isCapturing = false;
        captureSession = null;
    }
};

// parsig the packet
const parsePacket = (rawPacket) => {
    const packet = pcap.decode.packet(rawPacket);
    
    return {
        timestamp: new Date().toISOString(),
        length: rawPacket.header.len,
        protocol: getProtocol(packet),
        source: getSource(packet),
        destination: getDestination(packet),
        info: getInfo(packet)
    };
};

const getProtocol = (packet) => {
    if (packet.payload?.payload) {
        const protocol = packet.payload.payload.constructor.name;
        console.log("protocol:", protocol)
        return protocol || 'Unknown';
    }
    return 'Unknown';
};

const getSource = (packet) => {
    if (packet.payload?.saddr) {
        console.log("source:", packet.payload.saddr.toString())
        return packet.payload.saddr.toString();
    }
    return 'Unknown';
};

const getDestination = (packet) => {
    if (packet.payload?.daddr) {
        return packet.payload.daddr.toString();
    }
    return 'Unknown';
};

const getInfo = (packet) => {
    const payload = packet.payload?.payload;
    if (payload) {
        if (payload.constructor.name === 'TCP') {
            return `${payload.sport} → ${payload.dport}`;
        } else if (payload.constructor.name === 'UDP') {
            return `${payload.sport} → ${payload.dport}`;
        }
    }
    return '';
};

// Modify socket connection handler
io.on('connection', (socket) => {
    console.log('Client connected');

    // Comment out interface sending
    // const interfaces = getInterfaces();
    // console.log('Sending interfaces to client:', JSON.stringify(interfaces, null, 2));
    // socket.emit('interfaces', interfaces);

    socket.on('start-capture', () => {
        startCapture();
    });

    socket.on('stop-capture', () => {
        stopCapture();
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        if (isCapturing) {
            stopCapture();
        }
    });
});

// exp server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
