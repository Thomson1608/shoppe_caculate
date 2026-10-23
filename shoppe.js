/*CÁCH DÙNG:
B1: Mở Google Chrome, truy cập và đăng nhập vào Shopee.vn
B2: Vào mục "Đơn Mua": https://shope.ee/7pHF2r5lo0
B3: Nhấn tổ hợp phím Ctrl+Shift+J để mở tab "Console"
B4: Copy toàn bộ Code ở dưới. Paste vào tab "Console". Sau đó nhấn "Enter".
B5: Một box filter sẽ hiện ra ở góc trang, bạn nhập khoảng thời gian và lọc trực tiếp
Nguồn: @nttkq */

const ORDER_STATUS = {
  3: "Hoàn thành",
  4: "Đã hủy",
  7: "Vận chuyển",
  8: "Đang giao",
  9: "Chờ thanh toán",
  12: "Trả hàng",
};

const STORAGE_KEY = "shopee_orders_cache_v1";

function formatCurrency(number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(number || 0));
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseUnixDate(ts) {
  if (!ts) return null;
  const d = new Date(Number(ts) * 1000);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
}

function inTimeRange(timestamp, startDate, endDate) {
  if (!timestamp) return false;
  const ts = Number(timestamp) * 1000;
  const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

  if (start !== null && ts < start) return false;
  if (end !== null && ts > end) return false;
  return true;
}

function getDetail(item) {
  return item?.order_list_detail || item || {};
}

function getSubtotal(detail) {
  const infoCard = detail?.info_card || {};
  return safeNumber(infoCard?.subtotal || 0) / 1e5;
}

function getProductCount(detail) {
  const infoCard = detail?.info_card || {};
  return safeNumber(infoCard?.product_count || 0);
}

function getShopName(detail) {
  const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
  const shopInfo = orderCard?.shop_info || {};
  return `${shopInfo?.username || ""} - ${shopInfo?.shop_name || ""}`.trim();
}

function getProductName(detail) {
  const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
  const groups = orderCard?.product_info?.item_groups || [];
  return groups?.[0]?.items?.[0]?.name || "Không rõ";
}

function buildProductSummary(detail) {
  const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
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

function getDateText(detail) {
  const ts = detail?.shipping?.tracking_info?.ctime || 0;
  const d = parseUnixDate(ts);
  return d ? `${d.day}/${d.month}/${d.year}` : "-";
}

function getDateStamp(detail) {
  return Number(detail?.shipping?.tracking_info?.ctime || 0);
}

function getOrderStatus(detail) {
  const listType = Number(detail?.list_type || 0);
  return ORDER_STATUS[listType] || "Không rõ";
}

function downloadCsv(rows, filename) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllOrdersFromShopee() {
  let offset = 0;
  const limit = 20;
  const all = [];

  while (true) {
    const url =
      "https://shopee.vn/api/v4/order/get_all_order_and_checkout_list?limit=" +
      limit +
      "&offset=" +
      offset;

    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          accept: "application/json, text/plain, */*",
        },
      });

      const json = await res.json();
      const data = json?.new_data?.order_or_checkout_data ?? [];

      if (!Array.isArray(data) || data.length === 0) break;

      all.push(...data);
      offset += limit;
    } catch (error) {
      console.error("Lỗi khi fetch toàn bộ dữ liệu Shopee:", error);
      break;
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  const csvRows = [
    [
      "Tên chung",
      "Số lượng",
      "Tổng tiền",
      "Trạng thái",
      "Tên shop",
      "Chi tiết",
      "Tiền gốc",
      "Ngày Giao",
    ],
  ];

  for (const item of all) {
    const detail = getDetail(item);
    const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
    const shopInfo = orderCard?.shop_info || {};
    const productName = getProductName(detail);
    const productCount = getProductCount(detail);
    const subtotal = getSubtotal(detail);
    const statusText = getOrderStatus(detail);
    const shopName = `${shopInfo?.username || ""} - ${shopInfo?.shop_name || ""}`.trim();
    const dateText = getDateText(detail);

    csvRows.push([
      productName,
      productCount,
      formatCurrency(subtotal),
      statusText,
      shopName,
      buildProductSummary(detail),
      subtotal,
      dateText,
    ]);
  }

  downloadCsv(csvRows, "shopee_all_orders.csv");
  return all;
}

function loadCachedOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Không đọc được cache localStorage:", error);
    return [];
  }
}

function buildFilteredResult(allOrders, filters = {}) {
  const {
    startDate = "",
    endDate = "",
    shopKeyword = "",
    statusFilter = "",
  } = filters;

  const rows = [];
  let totalSpend = 0;
  let totalThisYear = 0;
  let totalSixMonths = 0;
  let totalOrderCount = 0;

  for (const item of allOrders) {
    const detail = getDetail(item);
    const listType = Number(detail?.list_type || 0);
    const subtotal = getSubtotal(detail);
    const productCount = getProductCount(detail);
    const productName = getProductName(detail);
    const shopName = getShopName(detail);
    const statusText = getOrderStatus(detail);
    const dateText = getDateText(detail);
    const ctime = getDateStamp(detail);

    const matchDate =
      (!startDate || inTimeRange(ctime, startDate, "")) &&
      (!endDate || inTimeRange(ctime, "", endDate));
    const matchShop = !shopKeyword || shopName.toLowerCase().includes(shopKeyword.toLowerCase());
    const matchStatus = !statusFilter || String(listType) === String(statusFilter);

    if (!(matchDate && matchShop && matchStatus)) continue;

    const isValidOrder = listType !== 4 && listType !== 12;
    if (isValidOrder) {
      totalSpend += subtotal;
      totalOrderCount += 1;

      const date = parseUnixDate(ctime);
      const currentYear = new Date().getFullYear();
      if (date && date.year === currentYear) {
        totalThisYear += subtotal;
        if (date.month >= 7 && date.month <= 12) {
          totalSixMonths += subtotal;
        }
      }
    }

    rows.push({
      productName,
      productCount,
      subtotal,
      statusText,
      shopName,
      detail,
      dateText,
      listType,
    });
  }

  const dataRows = rows.map((r) => [
    r.productName,
    r.productCount,
    formatCurrency(r.subtotal),
    r.statusText,
    r.shopName,
    buildProductSummary(r.detail),
    r.listType !== 4 && r.listType !== 12 ? r.subtotal : 0,
    r.dateText,
  ]);

  const summary = [
    `Tổng cộng: \t${totalOrderCount} đơn,\t${formatCurrency(totalSpend)}`,
    `Tổng cộng trong năm nay: \t${formatCurrency(totalThisYear)}`,
    `Tổng cộng 6 tháng cuối năm: \t${formatCurrency(totalSixMonths)}`,
  ].join("\n");

  const dataText = [
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
    ...dataRows.map((row) => row.join("\t")),
    `Tổng cộng: \t${totalOrderCount} đơn,\t${formatCurrency(totalSpend)}`,
    `Tổng cộng trong năm nay: \t${formatCurrency(totalThisYear)}`,
    `Tổng cộng 6 tháng cuối năm: \t${formatCurrency(totalSixMonths)}`,
  ].join("\n");

  return {
    totalSpend,
    totalThisYear,
    totalSixMonths,
    totalOrderCount,
    summary,
    dataText,
  };
}

function buildFilterPanel() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.top = "16px";
  panel.style.right = "16px";
  panel.style.width = "1200px";
  panel.style.maxWidth = "calc(100vw - 32px)";
  panel.style.background = "#fff";
  panel.style.border = "1px solid #ddd";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 10px 28px rgba(0,0,0,0.12)";
  panel.style.zIndex = "999999";
  panel.style.padding = "12px";
  panel.style.fontFamily = "Arial, sans-serif";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.gap = "10px";
  row.style.marginBottom = "10px";

  const startDate = document.createElement("input");
  startDate.type = "date";
  startDate.placeholder = "Từ ngày";
  startDate.style.padding = "8px 10px";
  startDate.style.minWidth = "160px";

  const endDate = document.createElement("input");
  endDate.type = "date";
  endDate.placeholder = "Đến ngày";
  endDate.style.padding = "8px 10px";
  endDate.style.minWidth = "160px";

  const shopInput = document.createElement("input");
  shopInput.type = "text";
  shopInput.placeholder = "Tên shop";
  shopInput.style.padding = "8px 10px";
  shopInput.style.minWidth = "180px";

  const statusSelect = document.createElement("select");
  statusSelect.innerHTML = `
    <option value="">Tất cả trạng thái</option>
    <option value="3">Hoàn thành</option>
    <option value="4">Đã hủy</option>
    <option value="7">Vận chuyển</option>
    <option value="8">Đang giao</option>
    <option value="9">Chờ thanh toán</option>
    <option value="12">Trả hàng</option>
  `;
  statusSelect.style.padding = "8px 10px";
  statusSelect.style.minWidth = "180px";

  const runBtn = document.createElement("button");
  runBtn.textContent = "Lọc / Tính";
  runBtn.style.padding = "9px 16px";
  runBtn.style.cursor = "pointer";
  runBtn.style.background = "#ee4d2d";
  runBtn.style.color = "#fff";
  runBtn.style.border = "none";
  runBtn.style.borderRadius = "8px";

  const refreshBtn = document.createElement("button");
  refreshBtn.textContent = "Lấy lại dữ liệu từ Shopee";
  refreshBtn.style.padding = "9px 16px";
  refreshBtn.style.cursor = "pointer";
  refreshBtn.style.background = "#0f766e";
  refreshBtn.style.color = "#fff";
  refreshBtn.style.border = "none";
  refreshBtn.style.borderRadius = "8px";

  const summaryBox = document.createElement("textarea");
  summaryBox.readOnly = true;
  summaryBox.style.width = "100%";
  summaryBox.style.height = "110px";
  summaryBox.style.border = "1px solid #ddd";
  summaryBox.style.borderRadius = "8px";
  summaryBox.style.padding = "10px";
  summaryBox.style.marginBottom = "10px";
  summaryBox.style.resize = "vertical";

  const resultBox = document.createElement("textarea");
  resultBox.readOnly = true;
  resultBox.style.width = "100%";
  resultBox.style.height = "520px";
  resultBox.style.border = "1px solid #ddd";
  resultBox.style.borderRadius = "8px";
  resultBox.style.padding = "10px";
  resultBox.style.resize = "vertical";

  row.appendChild(startDate);
  row.appendChild(endDate);
  row.appendChild(shopInput);
  row.appendChild(statusSelect);
  row.appendChild(runBtn);
  row.appendChild(refreshBtn);

  panel.appendChild(row);
  panel.appendChild(summaryBox);
  panel.appendChild(resultBox);

  document.body.appendChild(panel);

  async function updateDataFromCache() {
    const allOrders = loadCachedOrders();
    if (!allOrders.length) {
      summaryBox.value = "Đang lấy toàn bộ dữ liệu Shopee...";
      resultBox.value = "Đang lấy toàn bộ dữ liệu Shopee...";
      const fetched = await fetchAllOrdersFromShopee();
      const filtered = buildFilteredResult(fetched, {
        startDate: startDate.value,
        endDate: endDate.value,
        shopKeyword: shopInput.value,
        statusFilter: statusSelect.value,
      });
      summaryBox.value = filtered.summary;
      resultBox.value = filtered.dataText;
      return;
    }

    const filtered = buildFilteredResult(allOrders, {
      startDate: startDate.value,
      endDate: endDate.value,
      shopKeyword: shopInput.value,
      statusFilter: statusSelect.value,
    });

    summaryBox.value = filtered.summary;
    resultBox.value = filtered.dataText;
  }

  runBtn.onclick = async () => {
    await updateDataFromCache();
  };

  refreshBtn.onclick = async () => {
    summaryBox.value = "Đang tải lại dữ liệu từ Shopee...";
    resultBox.value = "Đang tải lại dữ liệu từ Shopee...";
    const all = await fetchAllOrdersFromShopee();
    const filtered = buildFilteredResult(all, {
      startDate: startDate.value,
      endDate: endDate.value,
      shopKeyword: shopInput.value,
      statusFilter: statusSelect.value,
    });
    summaryBox.value = filtered.summary;
    resultBox.value = filtered.dataText;
  };

  return { summaryBox, resultBox };
}

(async function init() {
  const cached = loadCachedOrders();
  if (cached.length === 0) {
    const all = await fetchAllOrdersFromShopee();
    const ui = buildFilterPanel();
    const filtered = buildFilteredResult(all, {});
    ui.summaryBox.value = filtered.summary;
    ui.resultBox.value = filtered.dataText;
    return;
  }

  const ui = buildFilterPanel();
  const filtered = buildFilteredResult(cached, {});
  ui.summaryBox.value = filtered.summary;
  ui.resultBox.value = filtered.dataText;
})();
