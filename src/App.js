import "antd/dist/antd.css";
import "./App.css";
import MainPageComponent from "./main/index";
import UploadPage from "./product";
import ProductPage from "./product/index";
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

import { Switch, Route, Link, useHistory } from "react-router-dom";

function App() {
  const history = useHistory();
  return (
    <div>
      <div id="header">
        <div id="header-area">
          <Link to="/">
            <img src="/images/icons/logo.png" alt="logo" />
          </Link>
          <Button
            size="large"
            onClick={function () {
              history.push("/upload");
            }}
            icon={<DownloadOutlined />}
          >
            상품 업로드
          </Button>
        </div>
      </div>
      <div id="body">
        <Switch>
          <Route exact={true} path="/">
            <MainPageComponent />
          </Route>
          <Route exact={true} path="/products/:id">
            <ProductPage />
          </Route>
          <Route exact={true} path="/upload">
            {console.log("1")}
            <UploadPage />
            {console.log("2")}
          </Route>
        </Switch>
      </div>
      <div id="footer"></div>
    </div>
  );
}

export default App;