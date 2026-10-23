/*CÁCH DÙNG:
B1: Mở Google Chrome, truy cập và đăng nhập vào Shopee.vn
B2: Vào mục "Đơn Mua": https://shope.ee/7pHF2r5lo0
B3: Nhấn tổ hợp phím Ctrl+Shift+J để mở tab "Console"
B4: Copy toàn bộ Code ở dưới. Paste vào tab "Console". Sau đó nhấn "Enter".
B5: Ra 1 box nhỏ cạnh trang Shopee, các bạn kéo ra, copy và paste vào Excel hoặc Google Sheet để xem
Nguồn: @nttkq */

const ORDER_STATUS = {
  3: "Hoàn thành",
  4: "Đã hủy",
  7: "Vận chuyển",
  8: "Đang giao",
  9: "Chờ thanh toán",
  12: "Trả hàng",
};

function formatCurrency(number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(number || 0));
}

function toDateFromUnix(time) {
  if (!time) return null;
  const date = new Date(Number(time) * 1000);
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function getOrderStatus(listType) {
  return ORDER_STATUS[listType] || "Không rõ";
}

async function getOrders(offset, limit) {
  const url =
    "https://shopee.vn/api/v4/order/get_all_order_and_checkout_list?limit=" +
    limit +
    "&offset=" +
    offset;

  const response = await fetch(url);
  const json = await response.json();
  const orderData = json?.data?.order_data || {};
  return Array.isArray(orderData.details_list) ? orderData.details_list : [];
}

function buildProductSummary(orderCard) {
  const groups = orderCard?.product_info?.item_groups || [];

  return groups
    .map((group) =>
      (group.items || [])
        .map(
          (item) =>
            `${item.name} -- amount: ${item.amount} -- price: ${formatCurrency(
              Number(item.item_price || 0)
            )}`
        )
        .join(", ")
    )
    .join("; ");
}

async function getAllOrders() {
  const limit = 20;
  let offset = 0;
  const allOrders = [
    [
      "Tên chung",
      "Số lượng",
      "Tổng tiền",
      "Trạng thái",
      "Tên shop",
      "Chi tiết",
      "Tiền gốc",
      "Ngày Giao",
    ].join("\t"),
  ];

  const currentYear = new Date().getFullYear();

  let totalSpend = 0;
  let totalThisYear = 0;
  let totalSixMonths = 0;
  let totalOrders = 0;
  let totalItems = 0;

  while (true) {
    const data = await getOrders(offset, limit);
    if (!data.length) break;

    for (const item of data) {
      const infoCard = item?.info_card || {};
      const listType = Number(item?.list_type || 0);
      const orderCard = infoCard?.order_list_cards?.[0] || {};
      const shopInfo = orderCard?.shop_info || {};
      const products = orderCard?.product_info?.item_groups || [];
      const productName = products?.[0]?.items?.[0]?.name || "Không rõ";

      const productCount = Number(infoCard?.product_count || 0);
      const subtotal = Number(infoCard?.subtotal || 0) / 1e5;
      const statusText = getOrderStatus(listType);
      const shopName = `${shopInfo?.username || ""} - ${shopInfo?.shop_name || ""}`.trim();
      const productSummary = buildProductSummary(orderCard);
      const date = toDateFromUnix(item?.shipping?.tracking_info?.ctime || item?.ctime || 0);
      const dateText = date ? `${date.day}/${date.month}/${date.year}` : "-";

      const isValidOrder = listType !== 4 && listType !== 12;
      if (isValidOrder) {
        totalSpend += subtotal;
        totalOrders += 1;
        totalItems += productCount;

        if (date && date.year === currentYear) {
          totalThisYear += subtotal;
          if (date.month >= 7 && date.month <= 12) {
            totalSixMonths += subtotal;
          }
        }
      }

      allOrders.push(
        [
          productName,
          productCount,
          formatCurrency(subtotal),
          statusText,
          shopName,
          productSummary,
          isValidOrder ? subtotal : 0,
          dateText,
        ].join("\t")
      );
    }

    console.log("Đã lấy: " + offset);
    offset += limit;
  }

  const totalLine = ["Tổng cộng: ", `${totalOrders} đơn,`, formatCurrency(totalSpend)].join("\t");
  const totalThisYearLine = ["Tổng cộng trong năm nay: ", `${totalThisYear > 0 ? "" : ""}`, formatCurrency(totalThisYear)].join("\t");
  const totalSixMonthsLine = ["Tổng cộng 6 tháng cuối năm: ", formatCurrency(totalSixMonths)].join("\t");

  allOrders.push(totalLine);
  allOrders.push(totalThisYearLine);
  allOrders.push(totalSixMonthsLine);

  const result = allOrders.join("\r\n");

  console.log(totalLine);
  console.log(totalThisYearLine);
  console.log(totalSixMonthsLine);

  document.write(`<textarea style="width: 1000px; height: 600px; font-size: 12px;">${result}</textarea>`);
}

getAllOrders();
