const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const http = require('http');
const axios = require('axios');

// Function to get the driver
const get_driver = async () => {
    const options = new chrome.Options();
    options.addArguments("--user-data-dir=/home/farjan/.config/google-chrome");
    options.addArguments("--profile-directory=Default");
    options.excludeSwitches(["enable-automation"]);
    options.addArguments("--disable-blink-features=AutomationControlled");
    options.addArguments("--remote-debugging-port=9222");
    options.addArguments("--start-maximized");
    options.addArguments("--force-device-scale-factor=0.8");
    
    return await new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

// Function to open google maps
const google_map = async (data) => {
    let driver = await get_driver();
    const collection = [];
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
            await driver.executeScript("arguments[0].scrollIntoView(true);", firstResult);
            await driver.sleep(2000);
            let childDivs = await firstResult.findElements({ xpath: './div[not(contains(@class, "TFQHme "))]' });

            childDivs.splice(0, 2);
            let index = 0;
            let loadingLimit = 4;
            console.log('Child Divs:', childDivs.length);
            while (index < childDivs.length) {
                if (!childDivs[index]) {
                    console.log("No more data found!");
                    break;
                }
                let childDiv = childDivs[index];
                console.log('Index:', index);

                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();
                await driver.actions().sendKeys('\uE015').perform();

                try {
                    await childDiv.click();
                    await driver.sleep(5000);

                    let collection = {};

                    const mainElement = await driver.findElement({ css: 'div[jstcache="4"]' });
            
                    // Get company name
                    let companyh1 = await mainElement.findElement({ css: 'h1' });
                    collection['company_name'] = (await companyh1.getText()).toString() ?? '';

                    try {
                        const parentDiv = await companyh1.findElement({ xpath: '..' }).findElement({ xpath: '..' });
                        const secondInnerDiv = await parentDiv.findElement({ xpath: './div[2]' });

                        // Get company type
                        const buttonElement = await secondInnerDiv.findElement({ css: 'button' });
                        collection['company_type'] = await buttonElement.getText() ?? '';
    
                        // Get Rating and Review
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


                    // Get region
                    const regionElements = await mainElement.findElement({ css: 'div[aria-label="Information for '+collection['company_name']+'"]' });

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

                    // Get all image links
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
                        await driver.sleep(7000);

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

                    // Store the collected data in json_data property
                    try {
                        await axios.post('http://agenticai.localhost.com/api/json-records', collection);
                        console.log('Data successfully sent to the API');
                        
                        await driver.actions().sendKeys('\uE015').perform();
                        await driver.actions().sendKeys('\uE015').perform();
                        await driver.actions().sendKeys('\uE015').perform();
                        await driver.actions().sendKeys('\uE015').perform();
                        await driver.actions().sendKeys('\uE015').perform();
                        await driver.actions().sendKeys('\uE015').perform();

                    } catch (error) {
                        console.error('Error sending data to the API:', error);
                    }

                    if (index == loadingLimit) {
                        childDivs = await firstResult.findElements({ xpath: './div[not(contains(@class, "TFQHme "))]' });
                        await driver.sleep(5000);
                        loadingLimit += 4;
                        console.log('Loading Limit:', loadingLimit);
                    }
                } catch (error) {}

                index++;
            }

        } catch (error) {}

    } catch (error) {

    } finally {
        await driver.quit();
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
