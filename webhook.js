const axios = require('axios');

async function handle_get(context, req) {
    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            context.log('WEBHOOK_VERIFIED');
            context.res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            context.res.sendStatus(403);
        }
    } else {
        context.res = {
            body: 'hello world!'
        };
    }
}

async function handle_post(context, req) {
    let body = req.body;
    try{
        // Checks if this is an event from a page subscription
        if (body.object === 'page') {
            context.log(JSON.stringify(body));
            // There may be multiple if batched => only process the top message
            if(body.entry && body.entry[0] && body.entry[0].messaging && body.entry[0].messaging[0]){
                // Gets the body of the webhook event
                let webhookEvent = body.entry[0].messaging[0];

                // Get the sender PSID
                let senderPsid = webhookEvent.sender.id;
                context.log('Sender PSID: ' + senderPsid);

                let receivedMessage = webhookEvent.message;
                let response;
                let chatGPTRepond;
                // Checks if the message contains text
                if (receivedMessage && receivedMessage.text) {
                    // Create the payload for a basic text message, which
                    // will be added to the body of your request to the Send API
                    context.log('receivedMessage:' + JSON.stringify(receivedMessage));
                    response = {
                        'text': `[Auto Reply] Your message: '${receivedMessage.text}'.`
                    };

                    // Get repond message from chatgpt
                    chatGPTRepond = await get_chat_gpt_respond(context, receivedMessage.text)
                    response = {
                        'text': `[Auto Reply] ${chatGPTRepond}`
                    };
                    // Send the response messagecontext.log('Call Send API.========================================================');
                    await call_send_api(context, senderPsid, response);
                }
            }else{
                context.log('No text message received');
            }
        } else {

            // Returns a '404 Not Found' if event is not from a page subscription
            context.res.sendStatus(404);
        }
    }catch(err){
        context.log.error('Some error occured.');
        context.log.error(err);
    }
}

async function call_send_api(context, senderPsid, message) {
    context.log(`Sending message: ${message}`);
    // The page access token we have generated in your app settings
    const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

    // Construct the message body
    let postData = {
        'access_token': PAGE_ACCESS_TOKEN,
        'recipient': {
            'id': senderPsid
        },
        //"messaging_type": "MESSAGE_TAG",
        //"tag": "POST_PURCHASE_UPDATE",
        'message': message
    };

    try{
        const response = await axios.post('https://graph.facebook.com/v16.0/me/messages', postData);
        context.log(JSON.stringify(response ? response.data : 'empty respond from graph api'));
    }catch(err){
        context.log.error(err.message);
        context.log.error(err);
    }
}


async function get_chat_gpt_respond(context, message){
    context.log(`Getting GPT Respond. message: ${message}`);
    const OPEN_AI_KEY = process.env.OPEN_AI_KEY;
    // Construct the message body
    let postData = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": `${message}`}],
        "temperature": 0.7
    };
    const options = {
        headers:{
            'Authorization': 'Bearer ' + OPEN_AI_KEY
        }
    }
    try{
        const response = await axios.post('https://api.openai.com/v1/chat/completions', postData, options);
        context.log(JSON.stringify(response ? response.data : 'empty respond from OpenAI'));
        return response.data.choices[0].message.content;
    }catch(err){
        return `Error: ${err.message}`
    }
}

module.exports = async function(context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    context.log('==============================================================================================================================');
    if (req.method === 'GET') {
        await handle_get(context, req);
    } else if (req.method === 'POST') {
        context.res.status(200).send('EVENT_RECEIVED');
        context.done();
        await handle_post(context, req);
    } else {
        context.res.status(200).send('EVENT_RECEIVED');
        context.done();
        //context.res.sendStatus(400);
    }
    context.log('End Function.');
}
