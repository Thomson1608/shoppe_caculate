/*CÁCH DÙNG:
B1: Mở Google Chrome, truy cập và đăng nhập vào Shopee.vn
B2: Vào mục "Đơn Mua": https://shope.ee/7pHF2r5lo0
B3: Nhấn tổ hợp phím Ctrl+Shift+J để mở tab "Console"
B4: Copy toàn bộ Code ở dưới. Paste vào tab "Console". Sau đó nhấn "Enter".
B5: Ra 1 box nhỏ cạnh trang Shopee, các bạn kéo ra, copy và paste vào Excel hoặc Google Sheet để xem
Nguồn: @nttkq */

let arrayYear = [];
let tamp = 0;

async function getOrders(offset, limit) {
  let url =
    "https://shopee.vn/api/v4/order/get_all_order_and_checkout_list?limit=" +
    limit +
    "&offset=" +
    offset;
  var ordersData = (await (await fetch(url)).json()).data.order_data;

  var detailList = ordersData.details_list;
  if (detailList) {
    return detailList;
  } else {
    return [];
  }
}
function _getDate(time) {
  if (time == "") {
    return "-";
  }
  let dateObject = new Date(time * 1000);
  let year = dateObject.getFullYear();
  let month = dateObject.getMonth() + 1; // Tháng bắt đầu từ 0
  let day = dateObject.getDate();
  if (arrayYear.length === 0) {
    arrayYear.push(year);
  }
  if (arrayYear.length != 0) {
    if (arrayYear[arrayYear.length - 1] != year) {
      arrayYear.push(year);
    }
  }
  return { month, year, day };
}
function _VietNamCurrency(number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(number);
}
async function getAllOrders() {
  const limit = 20;
  let offset = 0;
  let allOrders = [];
  allOrders.push(
    [
      "Tên chung",
      "Số lượng",
      "Tổng tiền",
      "Trạng thái",
      "Tên shop",
      "Chi tiết",
      "Tiền gốc",
      "Ngày Giao",
    ].join("\t")
  );
  let sum = 0;
  let sumYear = 0;
  let count = 0;
  let countyear = 0;
  let count6Month = 0;
  let sum6Month = 0;

  while (true) {
    let data = await getOrders(offset, limit);
    if (data.length == 0) break;
    for (const item of data) {
      const infoCard = item.info_card;
      const listType = item.list_type;
      const timeShip = item?.shipping?.tracking_info?.ctime || "";
      let strListType;
      switch (listType) {
        case 3:
          strListType = "Hoàn thành";
          break;
        case 4:
          strListType = "Đã hủy";
          break;
        case 7:
          strListType = "Vận chuyển";
          break;
        case 8:
          strListType = "Đang giao";
          break;
        case 9:
          strListType = "Chờ thanh toán";
          break;
        case 12:
          strListType = "Trả hàng";
          break;
        default:
          strListType = "Không rõ";
          break;
      }

      const productCount = infoCard.product_count;
      let subTotal = infoCard.subtotal / 1e5;
      count += productCount;
      const orderCard = infoCard.order_list_cards[0];
      const shopName =
        orderCard.shop_info.username + " - " + orderCard.shop_info.shop_name;
      const products = orderCard.product_info.item_groups;
      const productSumary = products
        .map((product) =>
          product.items
            .map(
              (item) =>
                item.name +
                "--amount: " +
                item.amount +
                "--price: " +
                _VietNamCurrency(item.item_price)
            )
            .join(", ")
        )
        .join("; ");
      const name = products[0].items[0].name;

      const subTotalNative = _VietNamCurrency(subTotal);
      let date = _getDate(timeShip);
      if (date != "-") {
        if (arrayYear.length != 0) {
          if (date.year === arrayYear[0] && listType != 4 && listType != 12) {
            sumYear += subTotal;
            countyear += productCount;
            if (date.month > 6) {
              sum6Month += subTotal;
              count6Month += productCount;
            }
          }
        }
        //sum year
        date = `${date.day}/${date.month}/${date.year}`;
      }
      if (listType != 4 && listType != 12) {
        sum += subTotal;
      } else {
        subTotal = 0;
      }

      allOrders.push(
        [
          name,
          productCount,
          subTotalNative,
          strListType,
          shopName,
          productSumary,
          subTotal,
          date,
        ].join("\t")
      );
    }
    console.log("Colected: " + offset);
    offset += limit;
  }
  const total = ["Tổng cộng: ", count + " đơn,", _VietNamCurrency(sum)].join(
    "\t"
  );
  const total6Month = [
    "Tổng cộng 6 tháng cuối năm: ",
    count6Month + " đơn,",
    _VietNamCurrency(sum6Month),
  ].join("\t");
  const totalYear = [
    "Tổng cộng trong năm nay: ",
    countyear + " đơn,",
    _VietNamCurrency(sumYear),
  ].join("\t");
  console.log(total);
  console.log(totalYear);
  console.log(total6Month);
  allOrders.push(total);
  allOrders.push(totalYear);
  allOrders.push(total6Month);
  var text = allOrders.join("\r\n");
  document.write("<textarea>" + text + "</textarea>");
}
getAllOrders();
