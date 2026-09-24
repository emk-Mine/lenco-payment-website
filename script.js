let selectedAmount = 0;


// Your Cloudflare Worker
const WORKER_URL =
    "https://lenco-payment-website.edward-munkanta.workers.dev";


// Your Lenco public key
const LENCO_PUBLIC_KEY =
    "pub-d5661748c0726669cb148577ac3b2d4f6f5c0af3adb9e9f1";


/*
    Open the payment card
*/

function openPayment(amount) {

    selectedAmount = amount;

    document.getElementById("selectedAmount").textContent =
        `Amount: K${amount}`;

    document.getElementById("paymentModal").style.display =
        "flex";
}


/*
    Close the payment card
*/

function closePayment() {

    document.getElementById("paymentModal").style.display =
        "none";
}


/*
    Generate a unique payment reference
*/

function generateReference() {

    return (
        "PAY-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()
    );
}


/*
    Start Lenco payment
*/

function payWithLenco() {

    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const phone =
        document.getElementById("phone").value.trim();


    // Validate details

    if (!name) {

        alert("Please enter your full name.");

        return;
    }


    if (!email) {

        alert("Please enter your email address.");

        return;
    }


    if (!phone) {

        alert("Please enter your phone number.");

        return;
    }


    if (!selectedAmount || selectedAmount <= 0) {

        alert("Please select a payment amount.");

        return;
    }


    // Split name

    const nameParts =
        name.split(/\s+/);

    const firstName =
        nameParts[0];

    const lastName =
        nameParts.slice(1).join(" ") || "";


    // Create reference

    const reference =
        generateReference();


    // Disable button

    const payButton =
        document.getElementById("payButton");

    payButton.disabled = true;

    payButton.textContent =
        "Opening payment...";


    /*
        Open Lenco checkout
    */

    LencoPay.getPaid({

        key: LENCO_PUBLIC_KEY,

        reference: reference,

        email: email,

        amount: selectedAmount,

        currency: "ZMW",

        channels: [
            "card",
            "mobile-money"
        ],

        customer: {

            firstName: firstName,

            lastName: lastName,

            phone: phone
        },


        onSuccess: async function(response) {

            console.log(
                "Lenco payment response:",
                response
            );


            payButton.textContent =
                "Verifying payment...";


            try {

                /*
                    Ask our Cloudflare Worker
                    to verify the payment.
                */

                const verification =
                    await fetch(
                        `${WORKER_URL}/verify?reference=${encodeURIComponent(reference)}`
                    );


                const result =
                    await verification.json();


                console.log(
                    "Verification result:",
                    result
                );


                /*
                    Check the verification result.

                    Lenco returns the payment status
                    inside the returned data.
                */

                const status =
                    result?.data?.status ||
                    result?.status;


                if (
                    verification.ok &&
                    (
                        status === "successful" ||
                        status === "success"
                    )
                ) {

                    alert(
                        "Payment successful!\n\n" +
                        "Reference: " +
                        reference
                    );

                    closePayment();

                } else {

                    alert(
                        "Payment was received but is still being confirmed.\n\n" +
                        "Reference: " +
                        reference
                    );
                }


            } catch (error) {

                console.error(
                    "Verification error:",
                    error
                );


                alert(
                    "Payment was submitted, but we could not confirm it yet.\n\n" +
                    "Reference: " +
                    reference
                );

            }


            payButton.disabled = false;

            payButton.textContent =
                "Pay Now";
        },


        onClose: function() {

            console.log(
                "Lenco payment window closed."
            );


            payButton.disabled = false;

            payButton.textContent =
                "Pay Now";
        },


        onConfirmationPending: function() {

            console.log(
                "Payment confirmation pending."
            );


            payButton.disabled = false;

            payButton.textContent =
                "Pay Now";


            alert(
                "Your payment is being confirmed. " +
                "Please wait for confirmation."
            );
        }

    });

}