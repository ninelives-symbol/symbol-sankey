
// Fetch and plot data based on the form values
function fetchDataAndPlot() {
  const addressInput = document.getElementById('address').value; // Get address value
  const addresses = addressInput.split(',').map(addr => addr.trim()); // Split addresses by newline
  const depth = document.getElementById('depth').value; // Get depth value
  const minAmount = document.getElementById('minAmount').value; // Get minimum amount value
  const mosaic = document.getElementById('mosaic').value; // Get mosaic ID
  const divisibility = document.getElementById('divisibility').value; // Get mosaic ID

  console.log(`Submitting form with addresses: ${addresses}, depth: ${depth}, minAmount: ${minAmount}, mosaic: ${mosaic}, divisibility: ${divisibility}`);

  const url = `http://localhost:5000/data?address=${addresses.join(',')}&depth=${Number(depth)}&minAmount=${Number(minAmount)}&mosaic=${mosaic}&divisibility=${divisibility}`;

  console.log(`Fetching data from: ${url}`);

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw response;
      }
      return response.json();
    })
    .then(data => {
      console.log(JSON.stringify(data, null, 2)); // Log data for debugging

      // Extract nodes and links from the data
      const nodes = data.nodes;
      const links = data.links;

      // Compute the maximum value for scaling colors and link widths
      const maxLinkValue = Math.max(...links.map(link => link.value));

      const colorScales = [
        ["#add8e6", "#00008b"], // light blue to dark blue
        ["#ffb6c1", "#8b0000"], // light red to dark red
        ["#90ee90", "#006400"], // light green to dark green
        //    ["#ffffe0", "#8b8b00"], // light yellow to dark yellow
        ["#d8bfd8", "#800080"], // light purple to dark purple
        ["#e6e6fa", "#00008b"], // light lavender to dark lavender
        ["#fafad2", "#808000"], // light goldenrod to dark goldenrod
        ["#ffc0cb", "#8b008b"], // light pink to dark pink
        ["#98fb98", "#008000"], // light palegreen to dark palegreen
        ["#ffdead", "#8b4513"], // light navajowhite to dark saddlebrown
      ];

      function hexToRgb(hex) {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : null;
      }

      function rgbToHex(rgb) {
        return "#" + ((1 << 24) | ((rgb[2] | (rgb[1] << 8)) | (rgb[0] << 16))).toString(16).slice(1);
      }

      function interpolateColor(color1, color2, factor) {
        let result = color1.slice();
        for (let i = 0; i < 3; i++) {
          result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
        }
        return result;
      }

      function interpolateColors(color1, color2, steps) {
        let stepFactor = 1 / (steps - 1),
          interpolatedColorArray = [];

        color1 = hexToRgb(color1);
        color2 = hexToRgb(color2);

        for (let i = 0; i < steps; i++) {
          interpolatedColorArray.push(rgbToHex(interpolateColor(color1, color2, stepFactor * i)));
        }

        return interpolatedColorArray;
      }

      // Create a Plotly Sankey diagram
      const plotData = {
        type: 'sankey',
        node: {
          pad: 15,
          thickness: nodes.map(node => node.value * 0.05), // Adjust the scaling factor here
          line: {
            color: 'black',
            width: 1
          },
          label: nodes.map((node, index) => {
            const addressIndex = addresses.indexOf(node.name);
            if (addressIndex !== -1) {
              return `<a href="${getExplorerURL(addresses[addressIndex])}" target="_blank">${node.name}</a>`;
            } else if (index >= addresses.length) {
              return `<a href="${getExplorerURL(node.name)}" target="_blank">${node.name}</a>`;
            } else {
              return node.name;
            }
          }),
          color: nodes.map(node => {
            let addressIndex = addresses.indexOf(node.name);
            return (addressIndex !== -1) ? colorScales[addressIndex % colorScales.length][1] : 'grey';
          }),
          hovertemplate: '<b>%{label}</b><br>Value: %{value}<extra></extra>',
          outlinewidth: 1,
          customdata: nodes.map(node => node.name), // Pass node address as custom data
        },
        link: {
          source: links.map(link => link.source),
          target: links.map(link => link.target),
          value: links.map(link => link.value),
          color: links.map(link => {
            const sourceNode = nodes[link.source];
            const targetNode = nodes[link.target];
            let addressIndex = addresses.indexOf(sourceNode.name);
            if (addressIndex === -1) addressIndex = addresses.indexOf(targetNode.name);
            let colorRange = (addressIndex !== -1) ? colorScales[addressIndex % colorScales.length] : ["#dcdcdc", "#808080"]; // light grey to dark grey
            const scaledValue = link.value / maxLinkValue; // scale the value between 0 and 1
            let colorArray = interpolateColors(colorRange[0], colorRange[1], 100); // interpolate 100 colors between start and end
            let colorIndex = Math.floor(scaledValue * colorArray.length);
            return colorArray[colorIndex];
          }),
          customdata: links.map(link => `https://symbol.fyi/transactions/${encodeURIComponent(link.hash)}`),
        },
        hovertemplate: 'Source: %{source.label}<br>Target: %{target.label}<br>Value: %{value}<br><a href="%{customdata}" target="_blank">Transaction Link</a><extra></extra>',
      };

      const layout = {
        title: `Transfers involving: ${addresses.join(', ')}`, // Update the title based on the addresses
        font: {
          size: 10
        },
        width: Math.max(1600, nodes.length * 1.5), // Dynamically adjust the width based on the number of nodes
        height: Math.max(1200, links.length * 1.25), // Dynamically adjust the height based on the number of links
        hovermode: 'closest'
      };

      Plotly.newPlot('sankey', [plotData], layout, { responsive: true }).then(function () {
        // Add the plotly_click event listener after the plot is created
        document.getElementById('sankey').on('plotly_click', function (event) {
          const clickedElement = event.points[0];
          if (clickedElement.curveNumber === 0) {
            // Check if it's a link ribbon
            const linkIndex = clickedElement.pointNumber;
            const url = plotData.link.customdata[linkIndex];
            if (url) {
              window.open(url, '_blank'); // Open URL in a new tab
            }
          }
        });
      });
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function getExplorerURL(address) {
  // Replace this with your implementation for generating the explorer URL
  return `https://symbol.fyi/accounts/${address}`;
}

// Listen for form submission
document.getElementById('input-form').addEventListener('submit', function (event) {
  event.preventDefault(); // Prevent page refresh
  fetchDataAndPlot();
});

window.addEventListener('load', function (event) {
  const urlParams = new URLSearchParams(window.location.search);
  const addressParam = urlParams.get('address');
  const depthParam = urlParams.get('depth');
  const minAmountParam = urlParams.get('minAmount');
  if (addressParam && depthParam && minAmountParam) {
    document.getElementById('address').value = addressParam;
    document.getElementById('depth').value = depthParam;
    document.getElementById('minAmount').value = minAmountParam;
    fetchDataAndPlot();
  }
});

