const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const http = require('http');
const axios = require('axios');
const mysql = require('mysql2/promise');
const fs = require('fs');



// Function to get the driver
const get_driver = async () => {
    const options = new chrome.Options();
    options.addArguments("--user-data-dir=/home/farjan/.config/google-chrome");
    options.addArguments("--profile-directory=Default");
    options.excludeSwitches(["enable-automation"]);
    options.addArguments("--disable-blink-features=AutomationControlled");
    options.addArguments("--remote-debugging-port=9222");
    options.addArguments("--start-maximized");
    options.addArguments("--headless");
    options.addArguments("--force-device-scale-factor=0.8");
    
    return await new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

// Function to send SMS via POST request
const send_sms = async (phoneNumber, message) => {
    try {
        const response = await axios.post('https://sms-provider-api.com/send', {
            to: phoneNumber,
            message: message
        }, {
            headers: {
                'Authorization': 'Bearer YOUR_API_KEY',
                'Content-Type': 'application/json'
            }
        });
        console.log('SMS sent successfully:', response.data);
    } catch (error) {
        console.error('Error sending SMS:', error.response?.data || error.message);
    }
};

// Function to open google maps
const google_map = async (data) => {
    let driver = await get_driver();
    try {
        const query = data.keyword + " " + data.location;
        await driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
        await driver.get("https://www.google.com/maps?hl=en");
        await driver.sleep(5000);
        await driver.findElement({ name: "q" }).sendKeys(query);
        await driver.sleep(1000);
        await driver.findElement({ name: "q" }).sendKeys('\uE007');
        await driver.sleep(5000);

        try {

            const firstResult = await driver.findElement({ css: 'div[aria-label^="Results for '+query+'"]' });

            await driver.sleep(1000);
            const myResult = await firstResult.findElement({ xpath: './/h1[contains(text(), "Results")][1]' });
            myResult.click();
            console.log('Clicked on Results');

            while (true) {
                try {
                    const endOfListText = await driver.findElement({ xpath: '//*[contains(text(), "You\'ve reached the end of the list.")]' });
                    if (endOfListText) {
                        break;
                    }
                } catch (error) {}
                await driver.actions().sendKeys('\uE015').perform();
                await driver.sleep(50);
            }
            
            await driver.sleep(1500);

            let childDivs = await firstResult.findElements({ xpath: './div[not(contains(@class, "TFQHme ")) and not(@class="") and normalize-space(.) != ""]' });
            childDivs.pop();
            console.log('Total Data Found: ', childDivs.length);

            let index = 0;
            while (index < childDivs.length) {
                if (!childDivs[index]) {
                    break;
                }
                
                let childDiv = childDivs[index];
                console.log('Index:', index);

                try {
                    await childDiv.click();
                    await driver.sleep(5000);

                    let collection = {};

                    const mainElement = await driver.findElement({ css: 'div[jstcache="4"]' });
                    
                    let companyh1;
                    try {
                        companyh1 = await mainElement.findElement({ css: 'h1' });
                        collection['company_name'] = (await companyh1.getText()).toString() ?? '';
                    } catch (error) {}

                    try {
                        const parentDiv = await companyh1.findElement({ xpath: '..' }).findElement({ xpath: '..' });
                        const secondInnerDiv = await parentDiv.findElement({ xpath: './div[2]' });

                        const buttonElement = await secondInnerDiv.findElement({ css: 'button' });
                        collection['company_type'] = await buttonElement.getText() ?? '';
    
                        const spanElements = await secondInnerDiv.findElements({ css: 'span' });
                        const spanTexts = [];
                        for (let spanElement of spanElements) {
                            const text = await spanElement.getText();
                            if (text && !spanTexts.includes(text) && text !== '.' && text !== collection['company_type']) {
                                spanTexts.push(text);
                            }
                        }
                        collection['rating'] = spanTexts[0] ?? '';
                        collection['total_review'] = spanTexts[1] ?? '';
                    } catch (error) {}

                    let regionElements;
                    try {
                        regionElements = await mainElement.findElement({ css: 'div[aria-label="Information for '+collection['company_name']+'"]' });
                    } catch (error) {}

                    try {
                        const regionTexts = await regionElements.findElement({ css: 'button[data-tooltip="Copy address"]' });
                        const regionArray = await regionTexts.getText();
                        const address = regionArray.split('\n');
                        collection['address'] = address[1];
                    } catch (error) {}

                    try {
                        const website = await regionElements.findElement({ css: 'a[data-tooltip="Open website"]' });
                        collection['website'] = await website.getAttribute('href') ?? '';
                    } catch (error) {}

                    try {
                        const phoneText = await regionElements.findElement({ css: 'button[data-tooltip="Copy phone number"]' });
                        const phoneArray = await phoneText.getText();
                        const phone = phoneArray.split('\n');
                        collection['phone'] = phone[1];
                    } catch (error) {}

                    try {
                        const plus_code = await regionElements.findElement({ css: 'button[data-tooltip="Copy plus code"]' });
                        const plus_codeArray = await plus_code.getText();
                        const plus_codeel = plus_codeArray.split('\n');
                        collection['map'] = plus_codeel[1];
                    } catch (error) {}

                    const imageElements = await mainElement.findElements({ css: 'img' });
                    const imageLinks = [];
                    for (let imageElement of imageElements) {
                        const src = await imageElement.getAttribute('src');
                        if (src) {
                        imageLinks.push(src);
                        }
                    }
                    collection['images'] = imageLinks;

                    try {
                        const review_button = await mainElement.findElement({ css: 'button[aria-label="Reviews for '+collection['company_name']+'"]' });
                        await review_button.click();
                        await driver.sleep(3000);

                        const refineReview = await mainElement.findElement({ css: 'div[aria-label="Refine reviews"]' });
                        const nextDiv = await refineReview.findElement({ xpath: './following-sibling::div' });
                        const reviewDivs = await nextDiv.findElements({ css: 'div.fontBodyMedium' });

                        collection['reviews'] = [];
                        let ii = 0;
                        for (let reviewDiv of reviewDivs) {
                            const reviewerButtons = await reviewDiv.findElements({ css: 'button' });

                            const reviewTextDiv = await reviewDiv.findElement({ css: 'div.MyEned' });
                            const reviewText = await reviewTextDiv.getText();

                            const reviewerButton = reviewerButtons[0];
                            const reviewerImageSrc = await reviewerButton.findElement({ css: 'img' }).getAttribute('src');
                            
                            const reviewerInfo = await reviewerButtons[1].findElements({ css: 'div' });
                            const reviewerName = await reviewerInfo[0].getText();
                            const reviewerRating = await reviewerInfo[1].getText();
                            
                            collection['reviews'][ii] = {
                                "reviewerImageSrc": reviewerImageSrc.toString(),
                                "reviewerName": reviewerName.toString(),
                                "reviewerRating": reviewerRating.toString(),
                                "reviewText": reviewText.toString()
                            };
                            ii++;
                        }
                    } catch (error) {}

                    let connection;
                    try {
                        connection = await mysql.createConnection({
                            host: 'localhost',
                            user: 'root',
                            password: '@fronure2025_Ltd',
                            database: 'others'
                        });

                        const query = `
                            INSERT INTO maps_pharmacy (
                                company_name, company_type, rating, total_review, address, website, phone, map, images, reviews
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;

                        const values = [
                            collection.company_name ?? null,
                            collection.company_type ?? null,
                            collection.rating ?? null,
                            collection.total_review ?? null,
                            collection.address ?? null,
                            collection.website ?? null,
                            collection.phone ?? null,
                            collection.map ?? null,
                            JSON.stringify(collection.images ?? []),
                            JSON.stringify(collection.reviews ?? [])
                        ];

                        const [result] = await connection.execute(query, values);
                        console.log('Data inserted into MySQL:', result.insertId);
                    } catch (error) {
                        console.error('Error inserting data into MySQL:', error);
                    } finally {
                        if (connection) {
                            await connection.end();
                        }
                    }

                } catch (error) {
                    console.log("data error: ", error);
                }

                index++;
            }

        } catch (error) {
            console.log("after search data: ", error);
        }

    } catch (error) {
        console.log("before search data: ", error);
    } finally {
        await driver.quit();
        console.log("........finined scapting........")
    }
};

// Function to handle HTTP requests
const requestHandler = async (req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            const postData = JSON.parse(body);
            setImmediate(() => {
                if(postData?.platform == 'google-map') {
                    google_map(postData);
                } else {
                    console.log("Platform is not define");
                }
            });
            res.end('Data received and processing started');
        });
    } else {
        res.end('Invalid request method');
    }
};


const server = http.createServer(requestHandler);

server.listen(8080, () => {
    console.log(`Server is listening on port ${8080}`);
});

const shutdown = () => {
    server.close(() => {
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
