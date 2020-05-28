if (document.readyState == 'loading') {
    document.addEventListener('DOMContentLoaded', ready)
} else {
    ready()
}

function ready() {
    var removeCartItemButtons = document.getElementsByClassName('btn-danger')
    for (var i = 0; i < removeCartItemButtons.length; i++) {
        var button = removeCartItemButtons[i]
        button.addEventListener('click', removeCartItem)
    }

    var quantityInputs = document.getElementsByClassName('cart-quantity-input')
    for (var i = 0; i < quantityInputs.length; i++) {
        var input = quantityInputs[i]
        input.addEventListener('change', quantityChanged)
    }

    var addToCartButtons = document.getElementsByClassName('shop-item-button')
    for (var i = 0; i < addToCartButtons.length; i++) {
        var button = addToCartButtons[i]
        button.addEventListener('click', addToCartClicked)
    }

    document.getElementsByClassName('btn-purchase')[0].addEventListener('click', purchaseClicked)
}

var stripeHandler = StripeCheckout.configure({
    key: stripePublicKey,
    locale: 'en',
    token: function(token) {
        var items = []
        var cartItemContainer = document.getElementsByClassName('cart-items')[0]
        var cartRows = cartItemContainer.getElementsByClassName('cart-row')

        for (var i = 0; i < cartRows.length; i++) {
            var cartRow = cartRows[i]
            var quantityElement = cartRow.getElementsByClassName('cart-quantity-input')[0]
            var quantity = quantityElement.value
            var id = cartRow.dataset.itemId

            items.push({
                id: id,
                quantity: quantity
            })
        }

        fetch('/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                stripeTokenId: token.id,
                items: items
            })
        }).then(function(res) {
            return res.json()
        }).then(function(data) {
            alert(data.message)
            var cartItems = document.getElementsByClassName('cart-items')[0]
            while (cartItems.hasChildNodes()) {
                cartItems.removeChild(cartItems.firstChild)
            }
            updateCartTotal()
        }).catch(function(error) {
            alert("Charge Failed")
            console.error(error)
        })
    }
})

function purchaseClicked() {
    var priceElement = document.getElementsByClassName('cart-total-price')[0]
    var price = parseFloat(priceElement.innerText.replace(/[^0-9.-]+/g,"")) * 100

    stripeHandler.open({
        amount: price
    })
}

function removeCartItem(event) {
    var buttonClicked = event.target
    buttonClicked.parentElement.parentElement.parentElement.remove()
    updateCartTotal()
}

function quantityChanged(event) {
    var input = event.target
    if (isNaN(input.value) || input.value <= 0) {
        input.value = 1
    }
    updateCartTotal()
}

function addToCartClicked(event) {
    var button = event.target
    var shopItem = button.parentElement.parentElement
    var title = shopItem.getElementsByClassName('shop-item-title')[0].innerText
    var price = shopItem.getElementsByClassName('shop-item-price')[0].innerText
    var imageSrc = shopItem.getElementsByClassName('shop-item-image')[0].src
    var id = shopItem.id
    addItemToCart(title, price, imageSrc, id)
    updateCartTotal()
}

function addItemToCart(title, price, imageSrc, id) {
    var cartRow = document.createElement('div')
    cartRow.classList.add('cart-row')
    cartRow.dataset.itemId = id
    var cartItems = document.getElementsByClassName('cart-items')[0]
    var cartItemNames = cartItems.getElementsByClassName('cart-item-title')
    for (var i = 0; i < cartItemNames.length; i++) {
        if (cartItemNames[i].innerText == title) {
            var input = document.getElementById(title)
            input.value = (parseInt(input.value) + 1)
            updateCartTotal()
            return
        }
    }
    var cartRowContents = 
        `<div id="${id}" class="row cart-item cart-column">
            <span class="column text-center" style="width:16.66%">
                <img class="cart-item-image" src="${imageSrc}" width="100" height="100">
            </span>
            <span class="column text-center" style="width:16.66%">
                <span class="cart-item-title">${title}</span>
            </span>
            <span class="column text-center cart-price" style="width:33.33%">${price}</span>
            <span class="column text-center" style="width:33.33%">
                <div class="cart-quantity">
                    <input id="${title}" class="cart-quantity-input" type="number" value="1">
                    <button class="btn btn-danger" type="button">REMOVE</button>
                </div>
            </span>
        </div>`

    cartRow.innerHTML = cartRowContents
    cartItems.append(cartRow)
    cartRow.getElementsByClassName('btn-danger')[0].addEventListener('click', removeCartItem)
    cartRow.getElementsByClassName('cart-quantity-input')[0].addEventListener('change', quantityChanged)
}

function updateCartTotal() {
    var cartItemContainer = document.getElementsByClassName('cart-items')[0]
    var cartRows = cartItemContainer.getElementsByClassName('cart-row')
    var total = 0
    for (var i = 0; i < cartRows.length; i++) {
        var cartRow = cartRows[i]
        var priceElement = cartRow.getElementsByClassName('cart-price')[0]
        var quantityElement = cartRow.getElementsByClassName('cart-quantity-input')[0]
        var price = parseFloat(priceElement.innerText.replace(/[^0-9.-]+/g,""))
        var quantity = quantityElement.value
        total = total + (price * quantity)
    }
    total = Math.round(total * 100) / 100
    document.getElementsByClassName('cart-total-price')[0].innerText = '$' + Number(total).toLocaleString('en')
}