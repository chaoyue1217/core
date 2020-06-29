import * as React from 'react';
import { IToolbarActionElementProps, IToolbarActionReactElement, IToolbarActionSelectProps } from '../types';
import { Select, SelectOptionsList, ISelectOptionsListProps, IDataOption, IDataOptionGroup, isDataOptionGroups } from '@ali/ide-components';
import { Emitter } from '@ali/ide-core-common';
import * as classnames from 'classnames';
import { getIcon } from '../../style/icon/icon';

export function ToolbarActionSelect<T>(props: IToolbarActionSelectProps<T> & IToolbarActionElementProps) {
  const [viewState, setViewState] = React.useState(props.defaultState || 'default');

  const styles = (props.styles || {})[viewState] || {};

  const selectStyle = {
    color: styles.labelForegroundColor,
    backgroundColor: styles.backgroundColor,
    minWidth: styles.minWidth === undefined ? 150 : styles.minWidth,
  };

  const optionStyle = {
    color: styles.labelForegroundColor,
    backgroundColor: styles.backgroundColor,
  };

  const [value, setValue] = React.useState(props.defaultValue);
  const [customOptions, setCustomOptions] = React.useState<IDataOption<T>[] | IDataOptionGroup<T>[] | undefined>(undefined);
  const [showDropdown, setShowDropDown] = React.useState<boolean>(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const selectInMenuRef = React.useRef<HTMLDivElement | null>(null);
  const selectEmitter = React.useRef(new Emitter<T>());

  React.useEffect(() => {
    const _onChangeState = new Emitter<{from: string, to: string}>();
    let _value = value;
    const delegate = {
      setState: (to) => {
        const from = viewState;
        setViewState(to);
        _onChangeState.fire({from, to});
      },
      setSelect: setValue,
      setOptions: (options) => {
        setCustomOptions(options);
      },
      getValue: () => {
        return _value;
      },
      onChangeState: _onChangeState.event,
      onSelect: selectEmitter.current.event,
    };
    props.delegate && props.delegate(delegate);
    const disposer = selectEmitter.current.event((v) => {
      _value = v;
    });
    return () => {
      props.delegate && props.delegate(undefined);
      _onChangeState.dispose();
      disposer.dispose();
    };
  }, []);

  function findCurrentValueLabel(value: T | undefined) {
    const options = customOptions || props.options || [];
    if (isDataOptionGroups(options)) {
      for (const group of options) {
        for (const option of group.options) {
          if (props.equals) {
            if (props.equals(option.value, value)) {
              return option.label;
            }
          } else {
            if (option.value === value) {
              return option.label;
            }
          }
        }
      }
    } else {
      for (const option of options) {
        if (props.equals) {
          if (props.equals(option.value, value)) {
            return option.label;
          }
        } else {
          if (option.value === value) {
            return option.label;
          }
        }
      }
    }
  }

  React.useEffect(() => {
    if (dropdownRef.current && selectInMenuRef.current) {
      const menuClientRect = selectInMenuRef.current.getBoundingClientRect();
      if (window.innerWidth - menuClientRect.x - menuClientRect.width < dropdownRef.current.offsetWidth) {
        dropdownRef.current.style.left = menuClientRect.x - dropdownRef.current.offsetWidth - 5 + 'px';
        dropdownRef.current.style.top = menuClientRect.y + 'px';
        dropdownRef.current.style.visibility = 'visible';
      } else {
        dropdownRef.current.style.left = menuClientRect.x + menuClientRect.width + 5 + 'px';
        dropdownRef.current.style.top = menuClientRect.y + 'px';
        dropdownRef.current.style.visibility = 'visible';
      }
    }
    if (showDropdown) {
      const listener = () => {
        setShowDropDown(false);
      };
      document.addEventListener('click', listener);
      return () => {
        document.removeEventListener('click', listener);
      };
    }
  }, [showDropdown]);

  if (props.inDropDown) {
    const selectDropDownProps: ISelectOptionsListProps<T> = {
      options: props.options,
      optionRenderer: props.customOptionRenderer,
      currentValue: value,
      className: 'kt-toolbar-action-select-dropdown',
      onSelect: (v) => {
        setValue(v);
        props.closeDropDown();
        if (props.onSelect) {
          props.onSelect(v);
        }
        selectEmitter.current.fire(v);
      },
      equals: props.equals,
      size: 'small',
      renderCheck: true,
    };
    const selectDropDown = <SelectOptionsList
      {...selectDropDownProps}
      ref={dropdownRef}
    />;
    return <div className={classnames({'kt-toolbar-action-btn': true,
    'action-btn-in-dropdown': true,
    'kt-toolbar-action-select': true})} ref={selectInMenuRef} onClick={() => {
      setShowDropDown(true);
    }}>
      {props.name || findCurrentValueLabel(value)}
      <div className={classnames('kt-toolbar-action-btn-icon', getIcon('right'), 'kt-toolbar-action-select-right')} />

      {showDropdown ? selectDropDown : null}
    </div>;
  }

  return <Select<T> value={value} options={customOptions || props.options} size='small' optionRenderer={props.customOptionRenderer} onChange={(v) => {
    if (props.onSelect) {
      props.onSelect(v!);
    }
    selectEmitter.current.fire(v);
  }} optionStyle={optionStyle} style={selectStyle}/>;
}

export function createToolbarActionSelect<T = string>(props: IToolbarActionSelectProps<T>): IToolbarActionReactElement {

  return ( actionProps ) => {
    return <ToolbarActionSelect {...props} {...actionProps} />;
  };
}
