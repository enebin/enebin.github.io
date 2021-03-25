function ChildComponent(props) {
  const { name, age } = props;

  return (
    <div>
      <p>
        Name is {name}, Age is {age}
      </p>
    </div>
  );
}

export default ChildComponent;
