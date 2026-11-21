
/* =========================
   CONFIGURATION
========================= */

const WORKER_URL =
    'https://lenco-payment-website.edward-munkanta.workers.dev';


/* =========================
   PRODUCTS
========================= */

const products = {

    product1: {
        name: 'Product 1',
        price: 55
    },

    product2: {
        name: 'Product 2',
        price: 150
    }

};


/* =========================
   GLOBAL VARIABLES
========================= */

let selectedProductId = null;

let currentReference = null;

let verifying = false;


/* =========================
   ELEMENT SELECTOR
========================= */

const $ = id => document.getElementById(id);


/* =========================
   SELECT PRODUCT
========================= */

function selectProduct(id) {

    if (!products[id]) {
        return;
    }

    selectedProductId = id;

    $('selectedProductName').textContent =
        products[id].name;

    $('selectedAmount').textContent =
        `Amount: K${products[id].price}`;

    $('paymentModal').style.display = 'flex';

}


/* =========================
   CLOSE PAYMENT POPUP
========================= */

function closePayment() {

    $('paymentModal').style.display = 'none';

}


/* =========================
   CLOSE STATUS POPUP
========================= */

function closeStatusPopup() {

    $('statusModal').style.display = 'none';

}


/* =========================
   SHOW PAYMENT STATUS
========================= */

function showStatus(
    type,
    title,
    message,
    reference = '',
    buttonText = 'OK',
    callback = closeStatusPopup
) {

    $('statusCard').className =
        `status-card ${type}`;

    $('statusIcon').textContent =
        type === 'success'
            ? '✓'
            : type === 'error'
                ? '!'
                : '…';

    $('statusTitle').textContent = title;

    $('statusMessage').textContent = message;

    $('statusReference').textContent =
        reference
            ? `Reference: ${reference}`
            : '';

    $('statusReference').style.display =
        reference ? 'block' : 'none';

    $('statusButton').textContent = buttonText;

    $('statusButton').onclick = callback;

    $('statusModal').style.display = 'flex';

}


/* =========================
   START LENCO PAYMENT
========================= */

async function payWithLenco() {

    const name =
        $('name').value.trim();

    const phone =
        $('phone').value.trim();

    const operator =
        $('network').value;


    // Validate payment details

    if (
        !selectedProductId ||
        !name ||
        !operator ||
        !phone
    ) {

        showStatus(
            'error',
            'Missing details',
            'Enter your name, network and mobile money number.'
        );

        return;

    }


    // Generate unique payment reference

    const reference =
        `PAY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;


    // Disable payment button

    const button = $('payButton');

    button.disabled = true;

    button.textContent = 'Starting payment...';


    try {

        // Send payment request to Cloudflare Worker

        const response = await fetch(
            `${WORKER_URL}/collect`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    productId: selectedProductId,
                    reference,
                    phone,
                    operator
                })
            }
        );


        // Read Lenco response

        const result = await response.json();


        // Check for errors

        if (!response.ok) {

            throw new Error(
                result.message || 'Payment request failed'
            );

        }


        // Save payment reference

        currentReference = reference;


        // Close payment form

        closePayment();


        // Show payment request confirmation

        showStatus(
            'sent',
            'Payment request sent',
            'Approve the request on your phone, then check the payment.',
            reference,
            'Check payment',
            () => checkPayment(reference)
        );


        // Automatically check payment after 5 seconds

        setTimeout(() => {

            if (currentReference === reference) {

                checkPayment(reference);

            }

        }, 5000);


    } catch (e) {

        showStatus(
            'error',
            'Payment could not start',
            e.message
        );

    } finally {

        button.disabled = false;

        button.textContent = 'Pay Now';

    }

}


/* =========================
   VERIFY LENCO PAYMENT
========================= */

async function checkPayment(reference) {

    // Prevent duplicate verification requests

    if (
        verifying ||
        currentReference !== reference
    ) {

        return;

    }

    verifying = true;


    try {

        // Request payment verification

        const response = await fetch(
            `${WORKER_URL}/verify?reference=${encodeURIComponent(reference)}`,
            {
                cache: 'no-store'
            }
        );


        // Read verification result

        const result = await response.json();


        // Handle verification errors

        if (!response.ok) {

            throw new Error(
                result.message || 'Verification failed'
            );

        }


        /* =========================
           PAYMENT SUCCESSFUL
        ========================= */

        if (
            result.status === 'successful' &&
            result.redirectUrl &&
            result.product
        ) {

            currentReference = null;

            closeStatusPopup();


            // Display purchased product

            $('summaryProduct').textContent =
                result.product.name;


            // Display amount paid

            $('summaryAmount').textContent =
                `K${result.product.amount}`;


            // Display transaction reference

            $('summaryReference').textContent =
                result.reference;


            // Set purchased product redirect link

            $('accessButton').href =
                result.redirectUrl;


            // Show purchase summary

            $('summaryModal').style.display =
                'flex';

        }


        /* =========================
           PAYMENT PENDING
        ========================= */

        else if (result.status === 'pending') {

            showStatus(
                'pending',
                'Payment still being confirmed',
                'Approve the payment on your phone, then check again.',
                reference,
                'Check again',
                () => checkPayment(reference)
            );

        }


        /* =========================
           PAYMENT FAILED
        ========================= */

        else {

            currentReference = null;

            showStatus(
                'error',
                'Payment not completed',
                'The payment was not confirmed. Please try again.',
                reference
            );

        }


    } catch (e) {

        showStatus(
            'pending',
            'Unable to confirm yet',
            'Please try checking again shortly.',
            reference,
            'Check again',
            () => checkPayment(reference)
        );

    } finally {

        verifying = false;

    }

}
