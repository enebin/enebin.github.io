import React from "react";
import { Menu, Input } from "antd";

const AppLayout = ({ children }) => {
  return (
    <div>
      <Menu>
        <Menu.Item key="home">노드버드</Menu.Item>
        <Menu.Item key="profile">프로필</Menu.Item>
        <Menu.Item key="email">
          <Input.Search enterButton />
        </Menu.Item>
      </Menu>
      {children}
    </div>
  );
};

export default AppLayout;
