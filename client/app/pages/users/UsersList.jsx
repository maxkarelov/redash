import { map } from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular';

import Button from 'antd/lib/button';
import { Paginator } from '@/components/Paginator';
import DynamicComponent from '@/components/DynamicComponent';
import { UserPreviewCard } from '@/components/PreviewCard';

import { wrap as itemsList, ControllerType } from '@/components/items-list/ItemsList';
import { ResourceItemsSource } from '@/components/items-list/classes/ItemsSource';
import { UrlStateStorage } from '@/components/items-list/classes/StateStorage';

import LoadingState from '@/components/items-list/components/LoadingState';
import EmptyState from '@/components/items-list/components/EmptyState';
import * as Sidebar from '@/components/items-list/components/Sidebar';
import ItemsTable, { Columns } from '@/components/items-list/components/ItemsTable';

import settingsMenu from '@/services/settingsMenu';
import { currentUser } from '@/services/auth';
import { policy } from '@/services/policy';
import { User } from '@/services/user';
import navigateTo from '@/services/navigateTo';
import { routesToAngularRoutes } from '@/lib/utils';

function UsersListActions({ user, enableUser, disableUser, deleteUser }) {
  if (user.id === currentUser.id) {
    return null;
  }
  if (user.is_invitation_pending) {
    return (
      <Button type="danger" className="w-100" onClick={event => deleteUser(event, user)}>Delete</Button>
    );
  }
  return user.is_disabled ? (
    <Button type="primary" className="w-100" onClick={event => enableUser(event, user)}>Enable</Button>
  ) : (
    <Button className="w-100" onClick={event => disableUser(event, user)}>Disable</Button>
  );
}

UsersListActions.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    is_invitation_pending: PropTypes.bool,
    is_disabled: PropTypes.bool,
  }).isRequired,
  enableUser: PropTypes.func.isRequired,
  disableUser: PropTypes.func.isRequired,
  deleteUser: PropTypes.func.isRequired,
};

class UsersList extends React.Component {
  static propTypes = {
    controller: ControllerType.isRequired,
  };

  sidebarMenu = [
    {
      key: 'active',
      href: 'users',
      title: 'Active Users',
    },
    {
      key: 'pending',
      href: 'users/pending',
      title: 'Pending Invitations',
    },
    {
      key: 'disabled',
      href: 'users/disabled',
      title: 'Disabled Users',
      isAvailable: () => policy.canCreateUser(),
    },
  ];

  listColumns = [
    Columns.custom.sortable((text, user) => (
      <UserPreviewCard user={user} withLink />
    ), {
      title: 'Name',
      field: 'name',
      width: null,
    }),
    Columns.custom.sortable((text, user) => map(user.groups, group => (
      <a key={'group' + group.id} className="label label-tag" href={'groups/' + group.id}>{group.name}</a>
    )), {
      title: 'Groups',
      field: 'groups',
    }),
    Columns.timeAgo.sortable({
      title: 'Joined',
      field: 'created_at',
      className: 'text-nowrap',
      width: '1%',
    }),
    Columns.timeAgo.sortable({
      title: 'Last Active At',
      field: 'active_at',
      className: 'text-nowrap',
      width: '1%',
    }),
    Columns.custom((text, user) => (
      <UsersListActions
        user={user}
        enableUser={this.enableUser}
        disableUser={this.disableUser}
        deleteUser={this.deleteUser}
      />
    ), {
      width: '1%',
      isAvailable: () => policy.canCreateUser(),
    }),
  ];

  onTableRowClick = (event, item) => navigateTo('users/' + item.id);

  enableUser = (event, user) => {
    // prevent default click action on table rows
    event.preventDefault();
    event.stopPropagation();
    return User.enableUser(user)
      .then(() => this.props.controller.update());
  };

  disableUser = (event, user) => {
    // prevent default click action on table rows
    event.preventDefault();
    event.stopPropagation();
    return User.disableUser(user)
      .then(() => this.props.controller.update());
  };

  deleteUser = (event, user) => {
    // prevent default click action on table rows
    event.preventDefault();
    event.stopPropagation();
    return User.deleteUser(user)
      .then(() => this.props.controller.update());
  };

  // eslint-disable-next-line class-methods-use-this
  renderPageHeader() {
    if (!policy.canCreateUser()) {
      return null;
    }
    return (
      <div className="m-b-15">
        <Button type="primary" disabled={!policy.isCreateUserEnabled()} href="users/new">
          <i className="fa fa-plus m-r-5" />
          New User
        </Button>
        <DynamicComponent name="UsersListExtra" />
      </div>
    );
  }

  renderSidebar() {
    const { controller } = this.props;
    return (
      <React.Fragment>
        <Sidebar.SearchInput
          value={controller.searchTerm}
          onChange={controller.updateSearch}
        />
        <Sidebar.Menu items={this.sidebarMenu} selected={controller.params.currentPage} />
        <Sidebar.PageSizeSelect
          options={controller.pageSizeOptions}
          value={controller.itemsPerPage}
          onChange={itemsPerPage => controller.updatePagination({ itemsPerPage })}
        />
      </React.Fragment>
    );
  }

  render() {
    const sidebar = this.renderSidebar();
    const { controller } = this.props;
    return (
      <React.Fragment>
        {this.renderPageHeader()}
        <div className="row">
          <div className="col-md-3 list-control-t">{sidebar}</div>
          <div className="list-content col-md-9">
            {!controller.isLoaded && <LoadingState className="" />}
            {controller.isLoaded && controller.isEmpty && <EmptyState className="" />}
            {
              controller.isLoaded && !controller.isEmpty && (
                <div className="table-responsive">
                  <ItemsTable
                    items={controller.pageItems}
                    columns={this.listColumns}
                    onRowClick={this.onTableRowClick}
                    context={this.actions}
                    orderByField={controller.orderByField}
                    orderByReverse={controller.orderByReverse}
                    toggleSorting={controller.toggleSorting}
                  />
                  <Paginator
                    totalCount={controller.totalItemsCount}
                    itemsPerPage={controller.itemsPerPage}
                    page={controller.page}
                    onChange={page => controller.updatePagination({ page })}
                  />
                </div>
              )
            }
          </div>
          <div className="col-md-3 list-control-r-b">{sidebar}</div>
        </div>
      </React.Fragment>
    );
  }
}

export default function init(ngModule) {
  settingsMenu.add({
    permission: 'list_users',
    title: 'Users',
    path: 'users',
    isActive: path => path.startsWith('/users') && (path !== '/users/me'),
    order: 2,
  });

  ngModule.component('pageUsersList', react2angular(itemsList(
    UsersList,
    new ResourceItemsSource({
      getRequest(request, { params: { currentPage } }) {
        switch (currentPage) {
          case 'active':
            request.pending = false;
            break;
          case 'pending':
            request.pending = true;
            break;
          case 'disabled':
            request.disabled = true;
            break;
          // no default
        }
        return request;
      },
      getResource() {
        return User.query.bind(User);
      },
      getItemProcessor() {
        return (item => new User(item));
      },
    }),
    new UrlStateStorage({ orderByField: 'created_at', orderByReverse: true }),
  )));

  return routesToAngularRoutes([
    {
      path: '/users',
      title: 'Users',
      key: 'active',
    },
    {
      path: '/users/pending',
      title: 'Pending Invitations',
      key: 'pending',
    },
    {
      path: '/users/disabled',
      title: 'Disabled Users',
      key: 'disabled',
    },
  ], {
    template: '<settings-screen><page-users-list on-error="handleError"></page-users-list></settings-screen>',
    reloadOnSearch: false,
    controller($scope, $exceptionHandler) {
      'ngInject';

      $scope.handleError = $exceptionHandler;
    },
  });
}

init.init = true;